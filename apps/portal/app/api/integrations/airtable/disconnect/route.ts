/**
 * Airtable Disconnect API
 * 
 * POST - Disconnect Airtable integration
 * Clears credentials from both vault and database
 */

import { createClient } from '@/lib/database/server'
import { NextResponse } from 'next/server'
import { getEntityInfo } from '@/lib/entity-type'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get entity info
    const entityInfo = await getEntityInfo()

    if (!entityInfo.tenantId) {
      return NextResponse.json({ 
        error: 'No tenant associated with user' 
      }, { status: 400 })
    }

    // Get existing settings to find vault ID
    const { data: existingSettings } = await (supabase as any)
      .from('tenant_integration_settings')
      .select('api_key_vault_id')
      .eq('tenant_id', entityInfo.tenantId)
      .eq('provider', 'airtable')
      .single()

    // Delete vault secret if it exists
    if (existingSettings?.api_key_vault_id) {
      try {
        await supabase.rpc('app_vault.delete_secret', { 
          p_id: existingSettings.api_key_vault_id 
        })
      } catch (error) {
        // Ignore errors - vault might not be available
        console.warn('Failed to delete vault secret:', error)
      }
    }

    // Clear the Airtable credentials
    const { error: updateError } = await (supabase as any)
      .from('tenant_integration_settings')
      .update({
        airtable_api_key: null,
        api_key_vault_id: null,
        airtable_base_id: null,
        airtable_table_name: null,
        is_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', entityInfo.tenantId)
      .eq('provider', 'airtable')

    if (updateError) {
      console.error('Failed to disconnect Airtable:', updateError)
      return NextResponse.json({ 
        error: 'Failed to disconnect Airtable' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Airtable disconnected successfully',
    })

  } catch (error) {
    console.error('Error in POST /api/integrations/airtable/disconnect:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

