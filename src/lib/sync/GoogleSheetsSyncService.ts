/**
 * Google Sheets Sync Service
 * Handles bidirectional synchronization between database and Google Sheets
 */

import { google, sheets_v4 } from 'googleapis';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  Transaction,
  SyncMetadata,
  SyncResult,
  SyncConflict,
  SheetTransaction,
  ColumnMapping,
  SyncSettings,
  SyncDirection,
} from './types';
import { generateTransactionFingerprint } from './fingerprint';
import { SpreadsheetDuplicateDetector } from './SpreadsheetDuplicateDetector';

// Default column mapping for Google Sheets
const DEFAULT_COLUMN_MAPPING: ColumnMapping = {
  date: 'A',
  description: 'B',
  amount: 'C',
  category: 'D',
  subcategory: 'E',
  notes: 'F',
};

// Default sync settings
const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  conflictResolution: 'last_write_wins',
  skipEmptyRows: true,
  dateFormat: 'YYYY-MM-DD',
  headerRow: 1,
  startRow: 2,
};

export interface GoogleSheetsSyncOptions {
  serviceAccountEmail?: string;
  serviceAccountPrivateKey?: string;
  columnMapping?: ColumnMapping;
  settings?: SyncSettings;
}

export class GoogleSheetsSyncService {
  private supabase: SupabaseClient;
  private sheets: sheets_v4.Sheets | null = null;
  private options: Required<GoogleSheetsSyncOptions>;
  private duplicateDetector: SpreadsheetDuplicateDetector;

  constructor(
    supabase: SupabaseClient,
    options: GoogleSheetsSyncOptions = {}
  ) {
    this.supabase = supabase;
    this.options = {
      serviceAccountEmail: options.serviceAccountEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
      serviceAccountPrivateKey: options.serviceAccountPrivateKey || 
        (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n') || ''),
      columnMapping: { ...DEFAULT_COLUMN_MAPPING, ...options.columnMapping },
      settings: { ...DEFAULT_SYNC_SETTINGS, ...options.settings },
    };
    this.duplicateDetector = new SpreadsheetDuplicateDetector(supabase);
  }

  /**
   * Initialize the Google Sheets API client
   */
  private async initializeClient(): Promise<sheets_v4.Sheets> {
    if (this.sheets) {
      return this.sheets;
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: this.options.serviceAccountEmail,
        private_key: this.options.serviceAccountPrivateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    return this.sheets;
  }

  /**
   * Pull transactions from a Google Sheet
   */
  async pullFromSheets(
    spreadsheetId: string,
    userId: string,
    options?: {
      sheetName?: string;
      range?: string;
      jobId?: string;
    }
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const conflicts: SyncConflict[] = [];
    let rowsPulled = 0;
    let rowsSkipped = 0;

    try {
      const sheets = await this.initializeClient();

      // Get spreadsheet metadata
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
      });

      const sheetName = options?.sheetName || spreadsheet.data.sheets?.[0]?.properties?.title || 'Sheet1';
      const range = options?.range || `${sheetName}!A:F`;

      // Read data from sheet
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values || [];
      
      if (rows.length <= 1) {
        return {
          success: true,
          direction: 'pull',
          rowsPushed: 0,
          rowsPulled: 0,
          rowsSkipped: 0,
          rowsUpdated: 0,
          conflictsDetected: 0,
          conflicts: [],
          duration: Date.now() - startTime,
        };
      }

      // Parse header row to determine column mapping
      const headerRow = rows[0] as string[];
      const columnMapping = this.detectColumnMapping(headerRow);

      // Parse transactions from rows
      const transactions: SheetTransaction[] = [];
      const startRow = this.options.settings.startRow || 2;

      for (let i = startRow - 1; i < rows.length; i++) {
        const row = rows[i] as string[];
        
        if (this.options.settings.skipEmptyRows && this.isEmptyRow(row)) {
          continue;
        }

        const transaction = this.parseRowToTransaction(row, columnMapping, i + 1);
        if (transaction) {
          transactions.push(transaction);
        }
      }

      if (transactions.length === 0) {
        return {
          success: true,
          direction: 'pull',
          rowsPushed: 0,
          rowsPulled: 0,
          rowsSkipped: 0,
          rowsUpdated: 0,
          conflictsDetected: 0,
          conflicts: [],
          duration: Date.now() - startTime,
        };
      }

      // Check for duplicates
      const similarity = await this.duplicateDetector.detectSimilarity(
        transactions as Transaction[],
        userId
      );

      // Get or create sync metadata
      const syncMetadata = await this.getOrCreateSyncMetadata(
        userId,
        spreadsheetId,
        spreadsheet.data.properties?.title || 'Untitled',
        sheetName
      );

      // Process transactions based on similarity
      if (similarity.action === 'merge') {
        // Only insert new transactions
        for (const newTx of similarity.newTransactions) {
          const sheetTx = newTx as SheetTransaction;
          await this.insertTransaction(
            sheetTx,
            userId,
            options?.jobId || null,
            spreadsheetId,
            syncMetadata.id
          );
          rowsPulled++;
        }
        rowsSkipped = similarity.duplicateTransactions.length;
      } else {
        // Insert all transactions
        for (const tx of transactions) {
          await this.insertTransaction(
            tx,
            userId,
            options?.jobId || null,
            spreadsheetId,
            syncMetadata.id
          );
          rowsPulled++;
        }
      }

      // Update sync metadata
      await this.updateSyncMetadata(syncMetadata.id, {
        last_sync_at: new Date().toISOString(),
        last_sync_direction: 'pull',
        row_count: rowsPulled,
        sync_status: 'idle',
      });

      // Log sync history
      await this.logSyncHistory(syncMetadata.id, userId, 'pull', 'completed', {
        rowsPulled,
        rowsSkipped,
        conflicts: conflicts.length,
      });

      return {
        success: true,
        direction: 'pull',
        rowsPushed: 0,
        rowsPulled,
        rowsSkipped,
        rowsUpdated: 0,
        conflictsDetected: conflicts.length,
        conflicts,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Error pulling from Google Sheets:', error);
      return {
        success: false,
        direction: 'pull',
        rowsPushed: 0,
        rowsPulled,
        rowsSkipped,
        rowsUpdated: 0,
        conflictsDetected: 0,
        conflicts: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Push transactions to a Google Sheet
   */
  async pushToSheets(
    spreadsheetId: string,
    userId: string,
    options?: {
      jobId?: string;
      sheetName?: string;
      mode?: 'append' | 'replace';
    }
  ): Promise<SyncResult> {
    const startTime = Date.now();
    let rowsPushed = 0;

    try {
      const sheets = await this.initializeClient();

      // Get transactions to push
      const query = this.supabase
        .from('categorized_transactions')
        .select(`
          *,
          job:categorization_jobs!inner(user_id)
        `)
        .eq('job.user_id', userId);

      if (options?.jobId) {
        query.eq('job_id', options.jobId);
      }

      const { data: transactions, error } = await query.order('date', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch transactions: ${error.message}`);
      }

      if (!transactions || transactions.length === 0) {
        return {
          success: true,
          direction: 'push',
          rowsPushed: 0,
          rowsPulled: 0,
          rowsSkipped: 0,
          rowsUpdated: 0,
          conflictsDetected: 0,
          conflicts: [],
          duration: Date.now() - startTime,
        };
      }

      // Get spreadsheet metadata
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
      });

      const sheetName = options?.sheetName || spreadsheet.data.sheets?.[0]?.properties?.title || 'Sheet1';

      // Prepare data for sheet
      const headers = ['Date', 'Description', 'Amount', 'Category', 'Subcategory', 'Notes', 'Status'];
      const rows = transactions.map(tx => [
        tx.date,
        tx.original_description,
        tx.amount,
        tx.category || '',
        tx.subcategory || '',
        tx.user_notes || '',
        tx.reconciliation_status || 'unreconciled',
      ]);

      if (options?.mode === 'replace') {
        // Clear existing data and write new
        await sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: `${sheetName}!A:G`,
        });

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [headers, ...rows],
          },
        });
      } else {
        // Append mode
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: rows,
          },
        });
      }

      rowsPushed = rows.length;

      // Update sync metadata
      const syncMetadata = await this.getOrCreateSyncMetadata(
        userId,
        spreadsheetId,
        spreadsheet.data.properties?.title || 'Untitled',
        sheetName
      );

      await this.updateSyncMetadata(syncMetadata.id, {
        last_sync_at: new Date().toISOString(),
        last_sync_direction: 'push',
        row_count: rowsPushed,
        sync_status: 'idle',
      });

      // Update transactions with sync info
      const transactionIds = transactions.map(tx => tx.id);
      await this.supabase
        .from('categorized_transactions')
        .update({
          last_synced_at: new Date().toISOString(),
          last_modified_source: 'database',
        })
        .in('id', transactionIds);

      // Log sync history
      await this.logSyncHistory(syncMetadata.id, userId, 'push', 'completed', {
        rowsPushed,
      });

      return {
        success: true,
        direction: 'push',
        rowsPushed,
        rowsPulled: 0,
        rowsSkipped: 0,
        rowsUpdated: 0,
        conflictsDetected: 0,
        conflicts: [],
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Error pushing to Google Sheets:', error);
      return {
        success: false,
        direction: 'push',
        rowsPushed,
        rowsPulled: 0,
        rowsSkipped: 0,
        rowsUpdated: 0,
        conflictsDetected: 0,
        conflicts: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Perform bidirectional sync with conflict detection
   */
  async bidirectionalSync(
    spreadsheetId: string,
    userId: string,
    options?: {
      jobId?: string;
      sheetName?: string;
    }
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const conflicts: SyncConflict[] = [];
    let rowsPushed = 0;
    let rowsPulled = 0;
    let rowsUpdated = 0;

    try {
      const sheets = await this.initializeClient();

      // Get spreadsheet metadata
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
      });

      const sheetName = options?.sheetName || spreadsheet.data.sheets?.[0]?.properties?.title || 'Sheet1';

      // Get sync metadata to check last sync time
      const syncMetadata = await this.getOrCreateSyncMetadata(
        userId,
        spreadsheetId,
        spreadsheet.data.properties?.title || 'Untitled',
        sheetName
      );

      // Step 1: Pull from sheets (detect new/changed rows)
      const pullResult = await this.pullFromSheets(spreadsheetId, userId, {
        sheetName,
        jobId: options?.jobId,
      });

      rowsPulled = pullResult.rowsPulled;
      conflicts.push(...pullResult.conflicts);

      // Step 2: Push local changes to sheets
      const pushResult = await this.pushToSheets(spreadsheetId, userId, {
        sheetName,
        jobId: options?.jobId,
        mode: 'replace', // Full sync replaces sheet content
      });

      rowsPushed = pushResult.rowsPushed;

      // Update sync metadata
      await this.updateSyncMetadata(syncMetadata.id, {
        last_sync_at: new Date().toISOString(),
        last_sync_direction: 'bidirectional',
        sync_status: 'idle',
      });

      return {
        success: true,
        direction: 'bidirectional',
        rowsPushed,
        rowsPulled,
        rowsSkipped: pullResult.rowsSkipped,
        rowsUpdated,
        conflictsDetected: conflicts.length,
        conflicts,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Error in bidirectional sync:', error);
      return {
        success: false,
        direction: 'bidirectional',
        rowsPushed,
        rowsPulled,
        rowsSkipped: 0,
        rowsUpdated,
        conflictsDetected: conflicts.length,
        conflicts,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Detect conflicts between local and remote data
   */
  async detectConflicts(
    spreadsheetId: string,
    userId: string
  ): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = [];

    try {
      const sheets = await this.initializeClient();

      // Get sheet data
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'A:G',
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) {
        return conflicts;
      }

      // Parse sheet transactions
      const headerRow = rows[0] as string[];
      const columnMapping = this.detectColumnMapping(headerRow);

      const sheetTransactions = new Map<string, SheetTransaction>();
      for (let i = 1; i < rows.length; i++) {
        const tx = this.parseRowToTransaction(rows[i] as string[], columnMapping, i + 1);
        if (tx && tx.transaction_fingerprint) {
          sheetTransactions.set(tx.transaction_fingerprint, tx);
        }
      }

      // Get local transactions with same fingerprints
      const fingerprints = Array.from(sheetTransactions.keys());
      
      const { data: localTransactions } = await this.supabase
        .from('categorized_transactions')
        .select(`
          *,
          job:categorization_jobs!inner(user_id)
        `)
        .eq('job.user_id', userId)
        .in('transaction_fingerprint', fingerprints);

      // Compare and detect conflicts
      for (const localTx of localTransactions || []) {
        const sheetTx = sheetTransactions.get(localTx.transaction_fingerprint);
        if (!sheetTx) continue;

        // Check for differences that indicate a conflict
        const hasConflict = 
          localTx.category !== sheetTx.category ||
          localTx.subcategory !== sheetTx.subcategory;

        if (hasConflict) {
          conflicts.push({
            id: '', // Will be assigned on insert
            user_id: userId,
            transaction_id: localTx.id,
            source_type: 'google_sheets',
            conflict_type: 'update',
            db_value: localTx,
            external_value: sheetTx as unknown as Transaction,
            resolution_status: 'pending',
            created_at: new Date().toISOString(),
          });
        }
      }

      // Store conflicts in database
      for (const conflict of conflicts) {
        const { data } = await this.supabase
          .from('sync_conflicts')
          .insert({
            user_id: conflict.user_id,
            transaction_id: conflict.transaction_id,
            source_type: conflict.source_type,
            conflict_type: conflict.conflict_type,
            db_value: conflict.db_value,
            external_value: conflict.external_value,
            resolution_status: 'pending',
          })
          .select('id')
          .single();

        if (data) {
          conflict.id = data.id;
        }
      }

      return conflicts;
    } catch (error) {
      console.error('Error detecting conflicts:', error);
      return conflicts;
    }
  }

  // ==================== Helper Methods ====================

  private detectColumnMapping(headerRow: string[]): ColumnMapping {
    const mapping: ColumnMapping = {};
    const columnLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    for (let i = 0; i < headerRow.length; i++) {
      const header = (headerRow[i] || '').toLowerCase().trim();
      const column = columnLetters[i];

      if (header.includes('date')) mapping.date = column;
      else if (header.includes('description') || header.includes('memo') || header.includes('details')) {
        mapping.description = column;
      }
      else if (header.includes('amount') || header.includes('value')) mapping.amount = column;
      else if (header.includes('category') && !header.includes('sub')) mapping.category = column;
      else if (header.includes('subcategory') || header.includes('sub-category')) mapping.subcategory = column;
      else if (header.includes('note')) mapping.notes = column;
    }

    return { ...DEFAULT_COLUMN_MAPPING, ...mapping };
  }

  private parseRowToTransaction(
    row: string[],
    columnMapping: ColumnMapping,
    rowIndex: number
  ): SheetTransaction | null {
    const getColumnIndex = (col: string): number => {
      return col.charCodeAt(0) - 'A'.charCodeAt(0);
    };

    const dateIdx = getColumnIndex(columnMapping.date || 'A');
    const descIdx = getColumnIndex(columnMapping.description || 'B');
    const amountIdx = getColumnIndex(columnMapping.amount || 'C');
    const categoryIdx = getColumnIndex(columnMapping.category || 'D');
    const subcategoryIdx = getColumnIndex(columnMapping.subcategory || 'E');
    const notesIdx = getColumnIndex(columnMapping.notes || 'F');

    const dateValue = row[dateIdx];
    const description = row[descIdx];
    const amountValue = row[amountIdx];

    if (!dateValue || !description || amountValue === undefined) {
      return null;
    }

    // Parse date
    const date = this.parseDate(dateValue);
    if (!date) return null;

    // Parse amount
    const amount = this.parseAmount(amountValue);
    if (amount === null) return null;

    const transaction: SheetTransaction = {
      original_description: description.trim(),
      amount,
      date,
      category: row[categoryIdx]?.trim() || null,
      subcategory: row[subcategoryIdx]?.trim() || null,
      user_notes: row[notesIdx]?.trim() || null,
      rowIndex,
      source_type: 'google_sheets',
      transaction_fingerprint: generateTransactionFingerprint(description, amount, date),
    };

    return transaction;
  }

  private isEmptyRow(row: string[]): boolean {
    return !row || row.every(cell => !cell || cell.trim() === '');
  }

  private parseDate(value: string): string | null {
    if (!value) return null;
    
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    return null;
  }

  private parseAmount(value: string): number | null {
    if (typeof value === 'number') return value;
    if (!value) return null;

    const cleaned = value.replace(/[$,€£¥]/g, '').replace(/,/g, '').trim();
    const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
    const numStr = isNegative ? cleaned.slice(1, -1) : cleaned;
    const parsed = parseFloat(numStr);

    if (!isNaN(parsed)) {
      return isNegative ? -parsed : parsed;
    }

    return null;
  }

  private async insertTransaction(
    transaction: SheetTransaction,
    userId: string,
    jobId: string | null,
    spreadsheetId: string,
    syncMetadataId: string
  ): Promise<void> {
    // If no job, create one
    let actualJobId = jobId;
    
    if (!actualJobId) {
      const { data: jobData } = await this.supabase
        .from('categorization_jobs')
        .insert({
          user_id: userId,
          job_type: 'spreadsheet',
          status: 'completed',
          processing_mode: 'sync',
          original_filename: `Google Sheets Import - ${new Date().toISOString()}`,
        })
        .select('id')
        .single();

      actualJobId = jobData?.id;
    }

    if (!actualJobId) {
      throw new Error('Failed to create categorization job');
    }

    await this.supabase.from('categorized_transactions').insert({
      job_id: actualJobId,
      original_description: transaction.original_description,
      amount: transaction.amount,
      date: transaction.date,
      category: transaction.category || null,
      subcategory: transaction.subcategory || null,
      source_type: 'google_sheets',
      source_identifier: spreadsheetId,
      external_row_id: transaction.rowIndex.toString(),
      transaction_fingerprint: transaction.transaction_fingerprint,
      last_synced_at: new Date().toISOString(),
      sync_version: 1,
    });
  }

  private async getOrCreateSyncMetadata(
    userId: string,
    spreadsheetId: string,
    spreadsheetName: string,
    sheetName: string
  ): Promise<SyncMetadata> {
    // Try to get existing
    const { data: existing } = await this.supabase
      .from('sync_metadata')
      .select('*')
      .eq('user_id', userId)
      .eq('source_type', 'google_sheets')
      .eq('source_id', spreadsheetId)
      .single();

    if (existing) {
      return existing as SyncMetadata;
    }

    // Create new
    const { data: newMetadata, error } = await this.supabase
      .from('sync_metadata')
      .insert({
        user_id: userId,
        source_type: 'google_sheets',
        source_id: spreadsheetId,
        source_name: spreadsheetName,
        sheet_name: sheetName,
        sync_status: 'idle',
        column_mapping: this.options.columnMapping,
        settings: this.options.settings,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create sync metadata: ${error.message}`);
    }

    return newMetadata as SyncMetadata;
  }

  private async updateSyncMetadata(
    id: string,
    updates: Partial<SyncMetadata>
  ): Promise<void> {
    await this.supabase
      .from('sync_metadata')
      .update(updates)
      .eq('id', id);
  }

  private async logSyncHistory(
    syncMetadataId: string,
    userId: string,
    direction: SyncDirection,
    status: string,
    details: Record<string, unknown>
  ): Promise<void> {
    await this.supabase.from('sync_history').insert({
      sync_metadata_id: syncMetadataId,
      user_id: userId,
      direction,
      status,
      completed_at: new Date().toISOString(),
      rows_pushed: details.rowsPushed || 0,
      rows_pulled: details.rowsPulled || 0,
      rows_skipped: details.rowsSkipped || 0,
      conflicts_detected: details.conflicts || 0,
      details,
    });
  }
}

/**
 * Factory function for creating a Google Sheets sync service
 */
export function createGoogleSheetsSyncService(
  supabase: SupabaseClient,
  options?: GoogleSheetsSyncOptions
): GoogleSheetsSyncService {
  return new GoogleSheetsSyncService(supabase, options);
}
