/**
 * Types for the Bidirectional Sync System
 */

// Transaction interface matching database schema
export interface Transaction {
  id?: string;
  job_id?: string;
  original_description: string;
  amount: number;
  date: string | Date;
  category?: string | null;
  subcategory?: string | null;
  confidence_score?: number;
  user_confirmed?: boolean;
  user_notes?: string | null;
  transaction_fingerprint?: string;
  source_type?: SourceType;
  source_identifier?: string | null;
  last_modified_source?: string | null;
  sync_version?: number;
  external_row_id?: string | null;
  last_synced_at?: string | null;
  reconciliation_status?: string;
  matched_document_id?: string | null;
}

export type SourceType = 'upload' | 'google_sheets' | 'manual' | 'api' | 'airtable';

export type SyncDirection = 'push' | 'pull' | 'bidirectional';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'pending';

export type SyncFrequency = 'manual' | 'realtime' | '15min' | 'hourly' | 'daily';

export type ConflictType = 'update' | 'delete' | 'create';

export type ResolutionStatus = 'pending' | 'resolved' | 'ignored';

export type ResolutionChoice = 'db' | 'external' | 'manual' | 'merge';

// Similarity detection result
export interface SimilarityResult {
  similarityScore: number;          // 0-100 percentage
  totalNewTransactions: number;     // Total transactions in upload
  matchingCount: number;            // Number that match existing
  existingJobId: string | null;     // Most likely matching job
  existingJobIds: string[];         // All jobs with matches
  newTransactions: Transaction[];   // Transactions to insert
  duplicateTransactions: Transaction[]; // Transactions to skip
  nearMatchTransactions: NearMatch[]; // Similar but not exact matches
  action: 'reject' | 'merge' | 'proceed';
  message: string;
}

export interface NearMatch {
  incoming: Transaction;
  existing: Transaction;
  matchType: 'amount_diff' | 'date_diff' | 'description_diff';
  difference: {
    amountDiff?: number;
    dateDiff?: number; // days
    descriptionSimilarity?: number; // 0-100
  };
}

// Sync metadata interface
export interface SyncMetadata {
  id: string;
  user_id: string;
  tenant_id?: string;
  source_type: SourceType;
  source_id: string;
  source_name?: string;
  sheet_name?: string;
  last_sync_at?: string;
  last_sync_direction?: SyncDirection;
  sync_cursor?: string;
  row_count: number;
  sync_status: SyncStatus;
  sync_error?: string;
  auto_sync_enabled: boolean;
  sync_frequency: SyncFrequency;
  next_sync_at?: string;
  linked_job_id?: string;
  column_mapping: ColumnMapping;
  settings: SyncSettings;
  created_at: string;
  updated_at: string;
}

export interface ColumnMapping {
  description?: string;
  amount?: string;
  date?: string;
  category?: string;
  subcategory?: string;
  notes?: string;
  [key: string]: string | undefined;
}

export interface SyncSettings {
  conflictResolution?: 'last_write_wins' | 'db_priority' | 'external_priority' | 'flag_for_review';
  skipEmptyRows?: boolean;
  dateFormat?: string;
  headerRow?: number;
  startRow?: number;
  [key: string]: unknown;
}

// Sync conflict interface
export interface SyncConflict {
  id: string;
  user_id: string;
  tenant_id?: string;
  transaction_id: string;
  sync_metadata_id?: string;
  source_type: string;
  conflict_type: ConflictType;
  db_value: Transaction;
  external_value: Transaction;
  db_modified_at?: string;
  external_modified_at?: string;
  resolution_status: ResolutionStatus;
  resolved_by?: string;
  resolved_at?: string;
  resolution_choice?: ResolutionChoice;
  resolution_notes?: string;
  created_at: string;
}

// Sync operation result
export interface SyncResult {
  success: boolean;
  direction: SyncDirection;
  rowsPushed: number;
  rowsPulled: number;
  rowsSkipped: number;
  rowsUpdated: number;
  conflictsDetected: number;
  conflicts: SyncConflict[];
  error?: string;
  duration?: number; // ms
  syncHistoryId?: string;
}

// Merge result for upload operations
export interface MergeResult {
  mode: 'insert' | 'merge' | 'reject';
  inserted: number;
  skipped: number;
  updated: number;
  similarityScore: number;
  matchedJobId?: string;
  message: string;
  jobId?: string;
}

// Google Sheets specific types
export interface SheetRange {
  sheetId: number;
  sheetName: string;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export interface SheetTransaction extends Transaction {
  rowIndex: number;           // 1-based row number in sheet
  lastModified?: string;      // Sheet cell modification time if available
}

// Fingerprint utilities
export interface FingerprintMatch {
  fingerprint: string;
  transaction_id: string;
  job_id: string;
}
