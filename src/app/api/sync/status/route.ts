import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/core/database/server';

/**
 * GET /api/sync/status
 * Get overall sync status for the current user
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

    // Get active syncs
    const { data: activeSyncs } = await supabase
      .from('sync_metadata')
      .select('id, source_name, source_type, sync_status, last_sync_at')
      .eq('user_id', user.id)
      .eq('sync_status', 'syncing');

    // Get pending conflicts count
    const { count: pendingConflicts } = await supabase
      .from('sync_conflicts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('resolution_status', 'pending');

    // Get total connections
    const { count: totalConnections } = await supabase
      .from('sync_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Get recent sync history
    const { data: recentSyncs } = await supabase
      .from('sync_history')
      .select(`
        *,
        sync_metadata:sync_metadata_id(source_name, source_type)
      `)
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(10);

    // Get transaction counts by source
    const { data: sourceCounts } = await supabase
      .from('categorized_transactions')
      .select('source_type')
      .eq('job.user_id', user.id);

    const sourceBreakdown: Record<string, number> = {};
    for (const tx of sourceCounts || []) {
      const source = (tx as { source_type: string }).source_type || 'upload';
      sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
    }

    // Get next scheduled sync
    const { data: nextScheduledSync } = await supabase
      .from('sync_metadata')
      .select('id, source_name, next_sync_at')
      .eq('user_id', user.id)
      .eq('auto_sync_enabled', true)
      .not('next_sync_at', 'is', null)
      .order('next_sync_at', { ascending: true })
      .limit(1)
      .single();

    return NextResponse.json({
      status: {
        has_active_syncs: (activeSyncs?.length || 0) > 0,
        active_syncs: activeSyncs || [],
        pending_conflicts: pendingConflicts || 0,
        total_connections: totalConnections || 0,
      },
      source_breakdown: sourceBreakdown,
      recent_syncs: recentSyncs || [],
      next_scheduled_sync: nextScheduledSync || null,
      warnings: buildWarnings(activeSyncs?.length || 0, pendingConflicts || 0),
    });
  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildWarnings(activeSyncs: number, pendingConflicts: number): string[] {
  const warnings: string[] = [];
  
  if (activeSyncs > 0) {
    warnings.push('Sync in progress. Some data may be incomplete.');
  }
  
  if (pendingConflicts > 0) {
    warnings.push(`${pendingConflicts} conflict(s) need resolution.`);
  }
  
  return warnings;
}

