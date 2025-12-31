import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/core/database/server'
import { google } from 'googleapis'
import { getGoogleOAuthClientForUser, ensureTemplateTabsAndFormulas } from '@/lib/integrations/google-sheets/create-spreadsheet'

type Body = {
  spreadsheetId: string
  preferredSourceSheetName?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as Body
    if (!body.spreadsheetId) {
      return NextResponse.json({ error: 'spreadsheetId is required' }, { status: 400 })
    }

    // Use OAuth so we can upgrade ANY spreadsheet the user has access to,
    // including those not owned by the service account.
    const { oauth2Client } = await getGoogleOAuthClientForUser(supabase, user.id)
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client })

    await ensureTemplateTabsAndFormulas(sheets, body.spreadsheetId, {
      preferredSourceSheetName: body.preferredSourceSheetName,
    })

    return NextResponse.json({
      success: true,
      spreadsheetId: body.spreadsheetId,
    })
  } catch (error: any) {
    console.error('Error upgrading sheet template:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to upgrade sheet template' },
      { status: 500 }
    )
  }
}


