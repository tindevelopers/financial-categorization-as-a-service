import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/core/database/server'
import { createSpreadsheetForUser } from '@/lib/integrations/google-sheets/create-spreadsheet'

const SUSPENSE_ACCOUNT_KEY = '__suspense__'

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // If suspense mapping already exists, return it
    const { data: existing, error: existingErr } = await (supabase as any)
      .from('account_sheet_mappings')
      .select('*')
      .eq('user_id', user.id)
      .eq('purpose', 'suspense')
      .eq('account_key', SUSPENSE_ACCOUNT_KEY)
      .maybeSingle()

    if (existingErr && existingErr.code !== 'PGRST116') {
      throw existingErr
    }

    if (existing?.spreadsheet_id) {
      return NextResponse.json({ success: true, mapping: existing })
    }

    const title = `FinCat Suspense - ${new Date().toLocaleDateString()}`
    const created = await createSpreadsheetForUser(
      supabase,
      { id: user.id, email: user.email },
      { purpose: 'suspense', title }
    )

    const { data: mapping, error: upsertErr } = await (supabase as any)
      .from('account_sheet_mappings')
      .upsert({
        user_id: user.id,
        tenant_id: null,
        account_key: SUSPENSE_ACCOUNT_KEY,
        purpose: 'suspense',
        spreadsheet_id: created.spreadsheetId,
        spreadsheet_name: created.spreadsheetName,
        sheet_tab_name: 'Transactions',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,account_key,purpose',
      })
      .select()
      .single()

    if (upsertErr) throw upsertErr

    return NextResponse.json({
      success: true,
      mapping,
      sheetUrl: created.sheetUrl,
      createdUnder: created.createdUnder,
    })
  } catch (error: any) {
    console.error('Error ensuring suspense sheet:', error)
    return NextResponse.json({ error: error?.message || 'Failed to ensure suspense sheet' }, { status: 500 })
  }
}


