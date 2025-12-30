/**
 * Airtable Status API
 * 
 * GET - Check Airtable connection status
 * Returns connected: false if not configured (graceful degradation)
 */

import { createClient } from '@/lib/database/server'
import { NextResponse } from 'next/server'
import { getEntityInfo } from '@/lib/entity-type'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ connected: false }, { status: 200 })
    }

    // Get entity info
    const entityInfo = await getEntityInfo()

    // Airtable is only for companies
    if (entityInfo.type !== 'company') {
      return NextResponse.json({ 
        connected: false,
        reason: 'individual_account',
      }, { status: 200 })
    }

    if (!entityInfo.tenantId) {
      return NextResponse.json({ connected: false }, { status: 200 })
    }

    // Check for Airtable integration settings
    const { data: settings, error: settingsError } = await (supabase as any)
      .from('tenant_integration_settings')
      .select('*')
      .eq('tenant_id', entityInfo.tenantId)
      .eq('provider', 'airtable')
      .single()

    if (settingsError || !settings) {
      return NextResponse.json({ connected: false }, { status: 200 })
    }

    // Check if we have the required credentials
    // Note: API key might be encrypted or in vault, so we check if it exists
    const hasApiKey = !!(settings.api_key_vault_id || settings.airtable_api_key)
    const isConnected = !!(hasApiKey && settings.airtable_base_id && settings.is_enabled)

    return NextResponse.json({
      connected: isConnected,
      baseId: isConnected ? settings.airtable_base_id : null,
      tableName: isConnected ? settings.airtable_table_name : null,
      updatedAt: settings.updated_at,
    }, { status: 200 })

  } catch (error) {
    console.error('Error in GET /api/integrations/airtable/status:', error)
    // Return graceful failure instead of error
    return NextResponse.json({ connected: false }, { status: 200 })
  }
}

