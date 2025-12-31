import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/core/database/server'

type UpsertMappingBody = {
  account_key: string
  spreadsheet_id: string
  spreadsheet_name?: string | null
  sheet_tab_name?: string | null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await (supabase as any)
      .from('account_sheet_mappings')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ mappings: data || [] })
  } catch (error: any) {
    console.error('Error listing account mappings:', error)
    return NextResponse.json({ error: 'Failed to list mappings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as UpsertMappingBody
    if (!body.account_key || !body.spreadsheet_id) {
      return NextResponse.json(
        { error: 'account_key and spreadsheet_id are required' },
        { status: 400 }
      )
    }

    const { data: upserted, error } = await (supabase as any)
      .from('account_sheet_mappings')
      .upsert({
        user_id: user.id,
        tenant_id: null,
        account_key: body.account_key,
        purpose: 'account',
        spreadsheet_id: body.spreadsheet_id,
        spreadsheet_name: body.spreadsheet_name || null,
        sheet_tab_name: body.sheet_tab_name || 'Transactions',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,account_key,purpose',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, mapping: upserted })
  } catch (error: any) {
    console.error('Error saving account mapping:', error)
    return NextResponse.json({ error: 'Failed to save mapping' }, { status: 500 })
  }
}


