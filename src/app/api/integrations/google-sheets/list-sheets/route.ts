import { createClient } from '@/core/database/server'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { decrypt } from '@/lib/encryption'

/**
 * Get Google OAuth credentials based on source stored in integration
 */
async function getGoogleCredentials(
  supabase: any, 
  userId: string, 
  source: 'tenant' | 'platform'
): Promise<{
  clientId: string | null;
  clientSecret: string | null;
}> {
  if (source === 'tenant') {
    // Get user's tenant ID
    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single()

    const tenantId = userData?.tenant_id

    if (tenantId) {
      const { data: tenantSettings } = await (supabase as any)
        .from('tenant_integration_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('provider', 'google_sheets')
        .single()

      if (tenantSettings?.custom_client_id && tenantSettings?.custom_client_secret) {
        let decryptedSecret = null
        try {
          decryptedSecret = decrypt(tenantSettings.custom_client_secret)
        } catch (error) {
          console.error('Failed to decrypt client secret:', error)
        }

        if (decryptedSecret) {
          return {
            clientId: tenantSettings.custom_client_id,
            clientSecret: decryptedSecret,
          }
        }
      }
    }
  }

  // Fall back to platform-level environment variables
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || null,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
  }
}

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
      .select('access_token, refresh_token, token_expires_at, metadata')
      .eq('user_id', user.id)
      .eq('provider', 'google_sheets')
      .single()

    if (intError || !integration) {
      return NextResponse.json({ 
        error: 'Google Sheets not connected',
        connected: false 
      }, { status: 400 })
    }

    // Get the credential source from metadata (set during OAuth)
    const credentialSource = integration.metadata?.credential_source || 'platform'
    console.log('[list-sheets] User:', user.id, 'Credential source:', credentialSource)
    console.log('[list-sheets] Integration metadata:', JSON.stringify(integration.metadata))
    
    // Get the appropriate credentials
    const credentials = await getGoogleCredentials(supabase, user.id, credentialSource)
    console.log('[list-sheets] Got credentials - clientId:', credentials.clientId?.substring(0, 20) + '...')

    if (!credentials.clientId || !credentials.clientSecret) {
      console.error('[list-sheets] Missing credentials - clientId:', !!credentials.clientId, 'clientSecret:', !!credentials.clientSecret)
      return NextResponse.json({ 
        error: 'Google Sheets credentials not configured',
        details: 'Could not find OAuth credentials. Please check your tenant settings or reconnect.',
        connected: false 
      }, { status: 500 })
    }

    // Set up OAuth client with correct credentials
    const oauth2Client = new google.auth.OAuth2(
      credentials.clientId,
      credentials.clientSecret
    )

    oauth2Client.setCredentials({
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
    })

    // Check if token needs refresh
    if (integration.token_expires_at && new Date(integration.token_expires_at) < new Date()) {
      try {
        const { credentials: newCredentials } = await oauth2Client.refreshAccessToken()
        
        // Update stored token
        await (supabase as any)
          .from('user_integrations')
          .update({
            access_token: newCredentials.access_token,
            token_expires_at: newCredentials.expiry_date 
              ? new Date(newCredentials.expiry_date).toISOString() 
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('provider', 'google_sheets')

        oauth2Client.setCredentials(newCredentials)
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
    
    console.log('[list-sheets] Attempting to list spreadsheets with credential source:', credentialSource)
    
    try {
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

      console.log('[list-sheets] Successfully listed', spreadsheets.length, 'spreadsheets')

      return NextResponse.json({ 
        spreadsheets,
        connected: true 
      })
    } catch (driveError: any) {
      console.error('[list-sheets] Drive API error:', driveError.message, driveError.code)
      
      // Check for specific Google API errors
      if (driveError.code === 403) {
        // Check if this is specifically an API not enabled error
        const errorMessage = driveError.message || ''
        if (errorMessage.includes('has not been used in project') || errorMessage.includes('is disabled')) {
          // Extract project ID from error message for a helpful link
          const projectMatch = errorMessage.match(/project (\d+)/)
          const projectId = projectMatch ? projectMatch[1] : ''
          const enableLink = projectId 
            ? `https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=${projectId}`
            : 'https://console.developers.google.com/apis/library/drive.googleapis.com'
          
          return NextResponse.json({ 
            error: 'Google Drive API not enabled',
            details: `The Google Drive API needs to be enabled in your Google Cloud project. Please visit ${enableLink} to enable it, then try again.`,
            enableLink,
            apiNotEnabled: true
          }, { status: 403 })
        }
        
        return NextResponse.json({ 
          error: 'Access denied. The Google Drive API may not be enabled or your credentials may not have permission.',
          details: driveError.message,
          needsReconnect: true
        }, { status: 403 })
      }
      
      if (driveError.code === 401) {
        return NextResponse.json({ 
          error: 'Authentication failed. Please reconnect Google Sheets.',
          needsReconnect: true
        }, { status: 401 })
      }
      
      throw driveError
    }
  } catch (error: any) {
    console.error('[list-sheets] Error:', error.message, error.stack)
    return NextResponse.json(
      { error: 'Failed to list spreadsheets', details: error.message },
      { status: 500 }
    )
  }
}
