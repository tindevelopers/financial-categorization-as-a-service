/**
 * Tenant Integration Settings API
 * 
 * GET - Retrieve tenant's integration settings
 * POST - Save/update tenant's integration settings
 * DELETE - Remove tenant's integration settings
 * 
 * Uses Supabase Vault for secure secret storage when available,
 * with fallback to application-level encryption.
 */

import { createClient } from '@/lib/database/server';
import { NextResponse } from 'next/server';
import { encrypt } from '@/lib/encryption';
import { getEntityInfo } from '@/lib/entity-type';
import { saveSecret, isVaultAvailable } from '@/lib/vault';

interface IntegrationSettingsInput {
  provider: string;
  // OAuth credentials - blocked from portal, admin-only
  custom_client_id?: string;
  custom_client_secret?: string;
  custom_redirect_uri?: string;
  use_custom_credentials?: boolean;
  dwd_subject_email?: string;
  // Airtable settings - allowed from portal for company accounts
  airtable_api_key?: string;
  airtable_base_id?: string;
  airtable_table_name?: string;
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
    // Check for both vault-stored secrets (vault IDs) and legacy encrypted secrets
    const maskedSettings = (settings || []).map((setting: any) => ({
      ...setting,
      // Mask secrets - show indicator if vault ID or legacy secret exists
      custom_client_secret: (setting.client_secret_vault_id || setting.custom_client_secret) 
        ? '••••••••' 
        : null,
      airtable_api_key: (setting.api_key_vault_id || setting.airtable_api_key) 
        ? '••••••••' 
        : null,
      // Include dwdSubjectEmail from settings JSONB
      dwd_subject_email: setting.settings?.dwdSubjectEmail || null,
      // Include vault status for debugging (optional, remove in production)
      _vault_enabled: !!setting.client_secret_vault_id || !!setting.api_key_vault_id,
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
 * 
 * Secrets are stored in Supabase Vault when available,
 * with fallback to application-level encryption.
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

    // Block custom OAuth credential management from portal - this is admin-only
    // Individual and Company accounts use platform OAuth, Enterprise uses admin-configured BYO credentials
    if (body.use_custom_credentials || body.custom_client_id || body.custom_client_secret || body.dwd_subject_email) {
      return NextResponse.json({ 
        error: 'Custom OAuth credentials can only be configured by platform administrators. Please contact support for Enterprise BYO setup.' 
      }, { status: 403 });
    }

    // Check if vault is available
    const vaultAvailable = await isVaultAvailable(supabase);
    console.log('[Tenant Settings] Vault available:', vaultAvailable);

    // Prepare data for upsert (non-secret fields)
    const settingsData: any = {
      tenant_id: entityInfo.tenantId,
      provider: body.provider,
      use_custom_credentials: body.use_custom_credentials ?? false,
      is_enabled: body.is_enabled ?? true,
      settings: body.settings ?? {},
      updated_at: new Date().toISOString(),
    };

    // Handle Airtable settings (allowed for company accounts from portal)
    if (body.airtable_base_id !== undefined) {
      settingsData.airtable_base_id = body.airtable_base_id || null;
    }

    if (body.airtable_table_name !== undefined) {
      settingsData.airtable_table_name = body.airtable_table_name || null;
    }

    // Handle Airtable API key - use vault if available, otherwise fall back to encryption
    if (body.airtable_api_key !== undefined && body.airtable_api_key !== '••••••••') {
      if (body.airtable_api_key) {
        if (vaultAvailable) {
          const vaultId = await saveSecret(
            supabase,
            entityInfo.tenantId,
            body.provider,
            'api_key',
            body.airtable_api_key
          );
          
          if (vaultId) {
            settingsData.api_key_vault_id = vaultId;
            settingsData.airtable_api_key = null;
            console.log('[Tenant Settings] API key stored in vault:', vaultId);
          } else {
            settingsData.airtable_api_key = encrypt(body.airtable_api_key);
          }
        } else {
          settingsData.airtable_api_key = encrypt(body.airtable_api_key);
        }
      } else {
        settingsData.airtable_api_key = null;
        settingsData.api_key_vault_id = null;
      }
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
      airtable_api_key: (result.api_key_vault_id || result.airtable_api_key) 
        ? '••••••••' 
        : null,
      _storage_method: vaultAvailable ? 'vault' : 'encryption',
    };

    console.log('[Tenant Settings] Settings saved:', {
      provider: body.provider,
      storageMethod: vaultAvailable ? 'vault' : 'encryption',
    });

    return NextResponse.json({
      success: true,
      settings: maskedResult,
      message: 'Settings saved successfully',
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

    // Get existing settings to find vault IDs
    const { data: existingSettings } = await (supabase as any)
      .from('tenant_integration_settings')
      .select('client_secret_vault_id, api_key_vault_id')
      .eq('tenant_id', entityInfo.tenantId)
      .eq('provider', provider)
      .single();

    // Delete vault secrets if they exist
    if (existingSettings?.client_secret_vault_id) {
      try {
        await supabase.rpc('app_vault.delete_secret', { 
          p_id: existingSettings.client_secret_vault_id 
        });
      } catch {
        // Ignore errors - vault might not be available
      }
    }

    if (existingSettings?.api_key_vault_id) {
      try {
        await supabase.rpc('app_vault.delete_secret', { 
          p_id: existingSettings.api_key_vault_id 
        });
      } catch {
        // Ignore errors
      }
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
