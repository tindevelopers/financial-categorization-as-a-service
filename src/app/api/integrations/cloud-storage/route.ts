import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/core/database/server';
import { getCloudStorageManager } from '@/lib/cloud-storage/CloudStorageManager';

/**
 * GET /api/integrations/cloud-storage
 * Get all cloud storage integrations for the current user
 */
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

    const { data: integrations, error } = await (supabase as any)
      .from('cloud_storage_integrations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching integrations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch integrations' },
        { status: 500 }
      );
    }

    // Remove sensitive token data from response
    const safeIntegrations = (integrations || []).map((integration: any) => ({
      id: integration.id,
      provider: integration.provider,
      folder_name: integration.folder_name,
      folder_id: integration.folder_id,
      sync_frequency: integration.sync_frequency,
      auto_sync_enabled: integration.auto_sync_enabled,
      last_sync_at: integration.last_sync_at,
      last_sync_status: integration.last_sync_status,
      last_sync_error: integration.last_sync_error,
      files_synced: integration.files_synced || 0,
      is_active: integration.is_active,
      created_at: integration.created_at,
    }));

    return NextResponse.json({
      success: true,
      integrations: safeIntegrations,
    });
  } catch (error: any) {
    console.error('Error in GET /api/integrations/cloud-storage:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/integrations/cloud-storage
 * Create a new cloud storage integration
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      provider,
      folder_id,
      folder_name,
      access_token,
      refresh_token,
      expires_at,
    } = body;

    if (!provider || !folder_id || !folder_name || !access_token) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, folder_id, folder_name, access_token' },
        { status: 400 }
      );
    }

    const cloudStorageManager = getCloudStorageManager();
    const integrationId = await cloudStorageManager.createIntegration(
      user.id,
      provider,
      folder_id,
      folder_name,
      access_token,
      refresh_token,
      expires_at ? new Date(expires_at) : undefined
    );

    return NextResponse.json({
      success: true,
      integration_id: integrationId,
    });
  } catch (error: any) {
    console.error('Error in POST /api/integrations/cloud-storage:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create integration' },
      { status: 500 }
    );
  }
}


