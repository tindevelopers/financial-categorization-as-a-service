import { createClient } from '@/core/database/server'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'

/**
 * List user's Google Sheets spreadsheets
 * Returns spreadsheets the user has access to
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get stored tokens
    const { data: integration, error: intError } = await (supabase as any)
      .from('user_integrations')
      .select('access_token, refresh_token, token_expires_at')
      .eq('user_id', user.id)
      .eq('provider', 'google_sheets')
      .single()

    if (intError || !integration) {
      return NextResponse.json({ 
        error: 'Google Sheets not connected',
        connected: false 
      }, { status: 400 })
    }

    // Set up OAuth client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )

    oauth2Client.setCredentials({
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
    })

    // Check if token needs refresh
    if (integration.token_expires_at && new Date(integration.token_expires_at) < new Date()) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken()
        
        // Update stored token
        await (supabase as any)
          .from('user_integrations')
          .update({
            access_token: credentials.access_token,
            token_expires_at: credentials.expiry_date 
              ? new Date(credentials.expiry_date).toISOString() 
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('provider', 'google_sheets')

        oauth2Client.setCredentials(credentials)
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError)
        return NextResponse.json({ 
          error: 'Token expired. Please reconnect Google Sheets.',
          connected: false,
          needsReconnect: true
        }, { status: 401 })
      }
    }

    // List spreadsheets using Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client })
    
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id, name, modifiedTime, webViewLink)',
      orderBy: 'modifiedTime desc',
      pageSize: 50,
    })

    const spreadsheets = response.data.files?.map(file => ({
      id: file.id,
      name: file.name,
      modifiedAt: file.modifiedTime,
      url: file.webViewLink,
    })) || []

    return NextResponse.json({ 
      spreadsheets,
      connected: true 
    })
  } catch (error: any) {
    console.error('Error listing sheets:', error)
    return NextResponse.json(
      { error: 'Failed to list spreadsheets' },
      { status: 500 }
    )
  }
}

