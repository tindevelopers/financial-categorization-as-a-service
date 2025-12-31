import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/core/database/server'
import { createSpreadsheetForUser } from '@/lib/integrations/google-sheets/create-spreadsheet'

type CreateSpreadsheetBody = {
  purpose?: 'account' | 'suspense'
  accountKey?: string
  spreadsheetName?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as CreateSpreadsheetBody
    const purpose = body.purpose || 'account'

    const title =
      body.spreadsheetName ||
      (purpose === 'suspense'
        ? `FinCat Suspense - ${new Date().toLocaleDateString()}`
        : `FinCat Transactions Export - ${new Date().toLocaleDateString()}`)

    const created = await createSpreadsheetForUser(
      supabase,
      { id: user.id, email: user.email },
      { purpose, title }
    )

    return NextResponse.json({
      success: true,
      spreadsheetId: created.spreadsheetId,
      spreadsheetName: created.spreadsheetName,
      sheetUrl: created.sheetUrl,
      createdUnder: created.createdUnder,
    })
  } catch (error: any) {
    console.error('Error creating spreadsheet:', error)
    const message = error?.message || 'Failed to create spreadsheet'
    const status =
      message === 'Google Sheets not connected' ? 400 :
      message.includes('not configured') ? 500 :
      500

    return NextResponse.json({ error: message }, { status })
  }
}


