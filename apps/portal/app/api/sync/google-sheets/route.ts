import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';

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

    // Check if sync_metadata table exists, if not return empty array
    const { data: syncMetadata, error } = await supabase
      .from('sync_metadata')
      .select('*')
      .eq('user_id', user.id)
      .eq('source_type', 'google_sheets')
      .order('last_sync_at', { ascending: false });

    // If table doesn't exist or query fails, return empty array
    if (error) {
      // Check if it's a table not found error (code 42P01 in Postgres)
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({
          connections: [],
        });
      }
      
      console.error('Error fetching sync metadata:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sync connections' },
        { status: 500 }
      );
    }

    // Get sync history for each connection
    const connectionsWithHistory = await Promise.all(
      (syncMetadata || []).map(async (meta: any) => {
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
    // Return empty array on error to prevent UI breakage
    return NextResponse.json({
      connections: [],
    });
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

    // For now, return a not implemented response
    // This endpoint can be enhanced later with full sync functionality
    return NextResponse.json(
      { error: 'Sync functionality not yet implemented' },
      { status: 501 }
    );
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

    // Delete sync conflicts if table exists
    try {
      await supabase
        .from('sync_conflicts')
        .delete()
        .eq('sync_metadata_id', connectionId);
    } catch (e) {
      // Table might not exist, ignore error
    }

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

