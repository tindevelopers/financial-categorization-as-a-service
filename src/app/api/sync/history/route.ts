/**
 * Sync History API
 * 
 * Endpoints:
 * - GET: Get sync history
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/core/database/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const syncMetadataId = searchParams.get('syncMetadataId');

    let query = supabase
      .from('sync_history')
      .select(`
        *,
        sync_metadata:sync_metadata_id(
          source_name,
          source_url
        )
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (syncMetadataId) {
      query = query.eq('sync_metadata_id', syncMetadataId);
    }

    const { data: history, error, count } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      history: history || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error('Get sync history error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get sync history' },
      { status: 500 }
    );
  }
}

