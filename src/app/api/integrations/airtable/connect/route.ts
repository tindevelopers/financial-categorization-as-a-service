/**
 * Airtable Connect API
 * 
 * POST - Validate and store Airtable credentials
 */

import { createClient } from '@/core/database/server'
import { NextResponse } from 'next/server'
import { encrypt } from '@/lib/encryption'
import { getEntityInfo } from '@/lib/entity-type'

interface AirtableConnectRequest {
  api_key: string
  base_id: string
  table_name?: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get entity info - only companies can use Airtable
    const entityInfo = await getEntityInfo()

    if (entityInfo.type !== 'company') {
      return NextResponse.json({ 
        error: 'Airtable integration is only available for company accounts' 
      }, { status: 403 })
    }

    if (!entityInfo.tenantId) {
      return NextResponse.json({ 
        error: 'No tenant associated with user. Please complete company setup first.' 
      }, { status: 400 })
    }

    // Parse request
    const body: AirtableConnectRequest = await request.json()

    if (!body.api_key || !body.base_id) {
      return NextResponse.json({ 
        error: 'API key and Base ID are required' 
      }, { status: 400 })
    }

    // Validate the Airtable credentials by making a test API call
    try {
      const testResponse = await fetch(
        `https://api.airtable.com/v0/${body.base_id}/${encodeURIComponent(body.table_name || 'Transactions')}?maxRecords=1`,
        {
          headers: {
            'Authorization': `Bearer ${body.api_key}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!testResponse.ok) {
        const errorData = await testResponse.json()
        console.error('Airtable validation failed:', errorData)
        
        if (testResponse.status === 401) {
          return NextResponse.json({ 
            error: 'Invalid API key. Please check your Airtable credentials.' 
          }, { status: 400 })
        }
        
        if (testResponse.status === 404) {
          return NextResponse.json({ 
            error: 'Base or table not found. Please check your Base ID and table name.' 
          }, { status: 400 })
        }

        return NextResponse.json({ 
          error: 'Failed to validate Airtable credentials. Please check your settings.' 
        }, { status: 400 })
      }
    } catch (error) {
      console.error('Airtable API error:', error)
      return NextResponse.json({ 
        error: 'Failed to connect to Airtable. Please try again.' 
      }, { status: 500 })
    }

    // Encrypt and store the credentials
    const encryptedApiKey = encrypt(body.api_key)

    const { error: upsertError } = await (supabase as any)
      .from('tenant_integration_settings')
      .upsert({
        tenant_id: entityInfo.tenantId,
        provider: 'airtable',
        airtable_api_key: encryptedApiKey,
        airtable_base_id: body.base_id,
        airtable_table_name: body.table_name || 'Transactions',
        is_enabled: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,provider',
      })

    if (upsertError) {
      console.error('Failed to store Airtable credentials:', upsertError)
      return NextResponse.json({ 
        error: 'Failed to save Airtable credentials' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Airtable connected successfully',
      base_id: body.base_id,
      table_name: body.table_name || 'Transactions',
    })

  } catch (error) {
    console.error('Error in POST /api/integrations/airtable/connect:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

