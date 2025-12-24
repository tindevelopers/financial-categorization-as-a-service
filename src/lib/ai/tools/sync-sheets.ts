/**
 * Sync Google Sheets Tool
 * 
 * Allows the AI to trigger Google Sheets synchronization
 */

import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';
import { createGoogleSheetsSyncService } from '@/lib/sync/GoogleSheetsSyncService';

export const syncSheetsSchema = z.object({
  spreadsheetId: z.string().describe('The Google Sheets spreadsheet ID'),
  direction: z.enum(['push', 'pull', 'bidirectional']).describe(
    'push: send data to sheet, pull: get data from sheet, bidirectional: sync both ways'
  ),
  sheetName: z.string().optional().describe('Specific sheet/tab name to sync with'),
  jobId: z.string().optional().describe('Limit sync to a specific categorization job'),
});

export type SyncSheetsParams = z.infer<typeof syncSheetsSchema>;

export const syncSheetsDescription = `Sync transactions with a connected Google Sheet. 
Use this tool when the user wants to push their categorized transactions to Google Sheets,
pull transactions from a sheet, or perform a bidirectional sync.
Always confirm with the user before syncing, as this modifies data.`;

export async function executeSyncSheets(
  params: SyncSheetsParams, 
  userId: string, 
  supabase: SupabaseClient
) {
  try {
    // Check if Google Sheets is configured
    const googleServiceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const googlePrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (!googleServiceEmail || !googlePrivateKey) {
      return {
        success: false,
        error: 'Google Sheets integration is not configured. Please set up your Google service account in Settings > Integrations.',
        configured: false,
      };
    }

    // Create the sync service
    const syncService = createGoogleSheetsSyncService(supabase);

    const options = {
      sheetName: params.sheetName,
      jobId: params.jobId,
    };

    let result: Awaited<ReturnType<typeof syncService.pushToSheets>>;

    switch (params.direction) {
      case 'push':
        result = await syncService.pushToSheets(params.spreadsheetId, userId, {
          ...options,
          mode: 'replace',
        });
        break;

      case 'pull':
        result = await syncService.pullFromSheets(params.spreadsheetId, userId, options);
        break;

      case 'bidirectional':
        result = await syncService.bidirectionalSync(params.spreadsheetId, userId, options);
        break;

      default:
        return {
          success: false,
          error: `Unknown sync direction: ${params.direction}`,
        };
    }

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Sync failed for unknown reason',
        details: {
          direction: params.direction,
          duration: result.duration,
        },
      };
    }

    // Build summary message
    const summaryParts: string[] = [];
    if (result.rowsPushed > 0) {
      summaryParts.push(`${result.rowsPushed} rows pushed to sheet`);
    }
    if (result.rowsPulled > 0) {
      summaryParts.push(`${result.rowsPulled} rows pulled from sheet`);
    }
    if (result.rowsSkipped > 0) {
      summaryParts.push(`${result.rowsSkipped} duplicate rows skipped`);
    }
    if (result.rowsUpdated > 0) {
      summaryParts.push(`${result.rowsUpdated} rows updated`);
    }
    if (result.conflictsDetected > 0) {
      summaryParts.push(`${result.conflictsDetected} conflicts detected`);
    }

    const summary = summaryParts.length > 0 
      ? summaryParts.join(', ') 
      : 'Sync completed with no changes';

    return {
      success: true,
      message: `Google Sheets sync completed successfully. ${summary}`,
      details: {
        direction: result.direction,
        rowsPushed: result.rowsPushed,
        rowsPulled: result.rowsPulled,
        rowsSkipped: result.rowsSkipped,
        rowsUpdated: result.rowsUpdated,
        conflictsDetected: result.conflictsDetected,
        duration: `${result.duration}ms`,
      },
      conflicts: result.conflicts.length > 0 ? result.conflicts.map(c => ({
        transactionId: c.transaction_id,
        type: c.conflict_type,
        status: c.resolution_status,
      })) : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during sync',
    };
  }
}
