import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/core/database/server';

/**
 * GET /api/sync/conflicts
 * Get pending sync conflicts for the current user
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '50');

    const { data: conflicts, error } = await supabase
      .from('sync_conflicts')
      .select(`
        *,
        transaction:categorized_transactions(
          id,
          original_description,
          amount,
          date,
          category,
          subcategory
        )
      `)
      .eq('user_id', user.id)
      .eq('resolution_status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching conflicts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch conflicts' },
        { status: 500 }
      );
    }

    // Get counts by status
    const { count: pendingCount } = await supabase
      .from('sync_conflicts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('resolution_status', 'pending');

    const { count: resolvedCount } = await supabase
      .from('sync_conflicts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('resolution_status', 'resolved');

    return NextResponse.json({
      conflicts: conflicts || [],
      summary: {
        pending: pendingCount || 0,
        resolved: resolvedCount || 0,
      },
    });
  } catch (error) {
    console.error('Sync conflicts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync/conflicts
 * Resolve a sync conflict
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
    const { conflictId, resolution, notes } = body;

    if (!conflictId || !resolution) {
      return NextResponse.json(
        { error: 'Missing conflictId or resolution' },
        { status: 400 }
      );
    }

    // Valid resolution choices: 'db', 'external', 'manual', 'merge'
    const validResolutions = ['db', 'external', 'manual', 'merge'];
    if (!validResolutions.includes(resolution)) {
      return NextResponse.json(
        { error: 'Invalid resolution choice' },
        { status: 400 }
      );
    }

    // Get the conflict
    const { data: conflict, error: conflictError } = await supabase
      .from('sync_conflicts')
      .select('*')
      .eq('id', conflictId)
      .eq('user_id', user.id)
      .single();

    if (conflictError || !conflict) {
      return NextResponse.json(
        { error: 'Conflict not found' },
        { status: 404 }
      );
    }

    // Cast conflict to any to work around type inference issues
    const conflictData = conflict as any;

    // Apply the resolution
    if (resolution === 'external' && conflictData.external_value) {
      // Update transaction with external value
      const externalValue = conflictData.external_value as Record<string, unknown>;
      
      const updateData: any = {
        category: externalValue.category,
        subcategory: externalValue.subcategory,
        user_notes: externalValue.user_notes,
        last_modified_source: 'external',
        sync_version: ((conflictData.db_value as Record<string, unknown>)?.sync_version as number || 1) + 1,
      };
      
      await supabase
        .from('categorized_transactions')
        .update(updateData)
        .eq('id', conflictData.transaction_id);
    }
    // If 'db' resolution, no changes needed to the transaction

    // Mark conflict as resolved
    const { error: updateError } = await supabase
      .from('sync_conflicts')
      .update({
        resolution_status: 'resolved',
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        resolution_choice: resolution,
        resolution_notes: notes || null,
      })
      .eq('id', conflictId);

    if (updateError) {
      console.error('Error resolving conflict:', updateError);
      return NextResponse.json(
        { error: 'Failed to resolve conflict' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Conflict resolved with '${resolution}' strategy`,
    });
  } catch (error) {
    console.error('Resolve conflict error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sync/conflicts
 * Ignore/dismiss a conflict
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
    const conflictId = searchParams.get('conflictId');

    if (!conflictId) {
      return NextResponse.json(
        { error: 'Missing conflictId' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('sync_conflicts')
      .update({
        resolution_status: 'ignored',
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', conflictId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error ignoring conflict:', error);
      return NextResponse.json(
        { error: 'Failed to ignore conflict' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Conflict ignored',
    });
  } catch (error) {
    console.error('Ignore conflict error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
