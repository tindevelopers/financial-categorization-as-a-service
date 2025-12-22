/**
 * Airtable Disconnect API
 * 
 * POST - Disconnect Airtable integration
 */

import { createClient } from '@/core/database/server'
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

    // Clear the Airtable credentials
    const { error: updateError } = await (supabase as any)
      .from('tenant_integration_settings')
      .update({
        airtable_api_key: null,
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

