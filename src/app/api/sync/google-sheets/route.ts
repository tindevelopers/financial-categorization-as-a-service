import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/core/database/server';
import { createGoogleSheetsSyncService } from '@/lib/sync';

/**
 * GET /api/sync/google-sheets
 * Get sync metadata for Google Sheets connections
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: syncMetadata, error } = await supabase
      .from('sync_metadata')
      .select('*')
      .eq('user_id', user.id)
      .eq('source_type', 'google_sheets')
      .order('last_sync_at', { ascending: false });

    if (error) {
      console.error('Error fetching sync metadata:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sync connections' },
        { status: 500 }
      );
    }

    // Get sync history for each connection
    const connectionsWithHistory = await Promise.all(
      (syncMetadata || []).map(async (meta) => {
        const { data: history } = await supabase
          .from('sync_history')
          .select('*')
          .eq('sync_metadata_id', meta.id)
          .order('started_at', { ascending: false })
          .limit(5);

        return {
          ...meta,
          recent_history: history || [],
        };
      })
    );

    return NextResponse.json({
      connections: connectionsWithHistory,
    });
  } catch (error) {
    console.error('Get sync metadata error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync/google-sheets
 * Trigger a sync operation
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { spreadsheetId, direction, sheetName, jobId } = body;

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Missing spreadsheetId' },
        { status: 400 }
      );
    }

    // Validate direction
    const validDirections = ['pull', 'push', 'bidirectional'];
    const syncDirection = direction || 'bidirectional';
    
    if (!validDirections.includes(syncDirection)) {
      return NextResponse.json(
        { error: 'Invalid sync direction' },
        { status: 400 }
      );
    }

    // Check if sync is already in progress for this sheet
    const { data: existingSync } = await supabase
      .from('sync_metadata')
      .select('sync_status')
      .eq('user_id', user.id)
      .eq('source_id', spreadsheetId)
      .single();

    if (existingSync?.sync_status === 'syncing') {
      return NextResponse.json(
        { error: 'A sync is already in progress for this spreadsheet' },
        { status: 409 }
      );
    }

    // Create sync service
    const syncService = createGoogleSheetsSyncService(supabase);

    // Perform sync based on direction
    let result;
    
    switch (syncDirection) {
      case 'pull':
        result = await syncService.pullFromSheets(spreadsheetId, user.id, {
          sheetName,
          jobId,
        });
        break;
      
      case 'push':
        result = await syncService.pushToSheets(spreadsheetId, user.id, {
          sheetName,
          jobId,
          mode: 'replace',
        });
        break;
      
      case 'bidirectional':
      default:
        result = await syncService.bidirectionalSync(spreadsheetId, user.id, {
          sheetName,
          jobId,
        });
        break;
    }

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error || 'Sync failed',
          details: result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result: {
        direction: result.direction,
        rows_pushed: result.rowsPushed,
        rows_pulled: result.rowsPulled,
        rows_skipped: result.rowsSkipped,
        rows_updated: result.rowsUpdated,
        conflicts_detected: result.conflictsDetected,
        duration_ms: result.duration,
      },
      message: `Sync completed: ${result.rowsPushed} pushed, ${result.rowsPulled} pulled`,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sync/google-sheets
 * Remove a sync connection
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Missing connectionId' },
        { status: 400 }
      );
    }

    // Delete sync history first (foreign key constraint)
    await supabase
      .from('sync_history')
      .delete()
      .eq('sync_metadata_id', connectionId);

    // Delete sync conflicts
    await supabase
      .from('sync_conflicts')
      .delete()
      .eq('sync_metadata_id', connectionId);

    // Delete the sync metadata
    const { error } = await supabase
      .from('sync_metadata')
      .delete()
      .eq('id', connectionId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting sync connection:', error);
      return NextResponse.json(
        { error: 'Failed to delete sync connection' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Sync connection removed',
    });
  } catch (error) {
    console.error('Delete sync connection error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
