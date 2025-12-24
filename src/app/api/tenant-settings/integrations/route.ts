/**
 * Tenant Integration Settings API
 * 
 * GET - Retrieve tenant's integration settings
 * POST - Save/update tenant's integration settings
 */

import { createClient } from '@/core/database/server';
import { NextResponse } from 'next/server';
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption';
import { getEntityInfo } from '@/lib/entity-type';

interface IntegrationSettingsInput {
  provider: string;
  custom_client_id?: string;
  custom_client_secret?: string;
  custom_redirect_uri?: string;
  airtable_api_key?: string;
  airtable_base_id?: string;
  airtable_table_name?: string;
  use_custom_credentials?: boolean;
  is_enabled?: boolean;
  settings?: Record<string, any>;
}

/**
 * GET - Retrieve tenant's integration settings
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get entity info
    const entityInfo = await getEntityInfo();
    
    if (!entityInfo.tenantId) {
      // No tenant - return empty settings
      return NextResponse.json({
        entityType: entityInfo.type,
        settings: [],
      });
    }

    // Get integration settings for this tenant
    const { data: settings, error: settingsError } = await (supabase as any)
      .from('tenant_integration_settings')
      .select('*')
      .eq('tenant_id', entityInfo.tenantId);

    if (settingsError) {
      console.error('Error fetching integration settings:', settingsError);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    // Mask sensitive values in response
    const maskedSettings = (settings || []).map((setting: any) => ({
      ...setting,
      custom_client_secret: setting.custom_client_secret ? '••••••••' : null,
      airtable_api_key: setting.airtable_api_key ? '••••••••' : null,
    }));

    return NextResponse.json({
      entityType: entityInfo.type,
      tenantId: entityInfo.tenantId,
      companyProfile: entityInfo.companyProfile,
      settings: maskedSettings,
    });

  } catch (error) {
    console.error('Error in GET /api/tenant-settings/integrations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Save/update tenant's integration settings
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get entity info
    const entityInfo = await getEntityInfo();

    if (!entityInfo.tenantId) {
      return NextResponse.json({ 
        error: 'No tenant associated with user. Please complete company setup first.' 
      }, { status: 400 });
    }

    // Parse request body
    const body: IntegrationSettingsInput = await request.json();

    if (!body.provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
    }

    // Check if entity type allows custom credentials
    if (entityInfo.type === 'individual' && body.use_custom_credentials) {
      return NextResponse.json({ 
        error: 'Individual accounts cannot use custom OAuth credentials. Please upgrade to a company account.' 
      }, { status: 403 });
    }

    // Prepare data for upsert
    const settingsData: any = {
      tenant_id: entityInfo.tenantId,
      provider: body.provider,
      use_custom_credentials: body.use_custom_credentials ?? false,
      is_enabled: body.is_enabled ?? true,
      settings: body.settings ?? {},
      updated_at: new Date().toISOString(),
    };

    // Handle custom OAuth credentials (Google Sheets)
    if (body.custom_client_id !== undefined) {
      settingsData.custom_client_id = body.custom_client_id || null;
    }
    
    if (body.custom_client_secret !== undefined && body.custom_client_secret !== '••••••••') {
      // Encrypt the secret before storing
      settingsData.custom_client_secret = body.custom_client_secret 
        ? encrypt(body.custom_client_secret) 
        : null;
    }

    if (body.custom_redirect_uri !== undefined) {
      settingsData.custom_redirect_uri = body.custom_redirect_uri || null;
    }

    // Handle Airtable credentials
    if (body.airtable_api_key !== undefined && body.airtable_api_key !== '••••••••') {
      settingsData.airtable_api_key = body.airtable_api_key 
        ? encrypt(body.airtable_api_key) 
        : null;
    }

    if (body.airtable_base_id !== undefined) {
      settingsData.airtable_base_id = body.airtable_base_id || null;
    }

    if (body.airtable_table_name !== undefined) {
      settingsData.airtable_table_name = body.airtable_table_name || null;
    }

    // Upsert the settings
    const { data: result, error: upsertError } = await (supabase as any)
      .from('tenant_integration_settings')
      .upsert(settingsData, {
        onConflict: 'tenant_id,provider',
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Error saving integration settings:', upsertError);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    // Return masked result
    const maskedResult = {
      ...result,
      custom_client_secret: result.custom_client_secret ? '••••••••' : null,
      airtable_api_key: result.airtable_api_key ? '••••••••' : null,
    };

    return NextResponse.json({
      success: true,
      settings: maskedResult,
    });

  } catch (error) {
    console.error('Error in POST /api/tenant-settings/integrations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE - Remove a tenant's integration settings for a provider
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');

    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
    }

    // Get entity info
    const entityInfo = await getEntityInfo();

    if (!entityInfo.tenantId) {
      return NextResponse.json({ error: 'No tenant associated with user' }, { status: 400 });
    }

    // Delete the settings
    const { error: deleteError } = await (supabase as any)
      .from('tenant_integration_settings')
      .delete()
      .eq('tenant_id', entityInfo.tenantId)
      .eq('provider', provider);

    if (deleteError) {
      console.error('Error deleting integration settings:', deleteError);
      return NextResponse.json({ error: 'Failed to delete settings' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in DELETE /api/tenant-settings/integrations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

