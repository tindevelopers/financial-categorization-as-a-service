import { createClient } from '@/lib/database/server'
import { NextResponse } from 'next/server'
import { decrypt } from '@/lib/encryption'
import { getSecret, isVaultAvailable } from '@/lib/vault'

/**
 * Get Google OAuth credentials
 * Priority: 1) Custom tenant credentials (from vault or encrypted), 2) Environment variables
 * 
 * Note: In Vercel, the 'develop' branch uses Preview environment variables, not Development.
 */
async function getGoogleCredentials(supabase: any, userId: string): Promise<{
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string;
  source: 'tenant' | 'platform';
}> {  
  const nextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const vercelUrl = process.env.VERCEL_URL?.trim();  const baseUrl = (nextPublicAppUrl || 
    (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3000')).trim()
  const defaultRedirectUri = `${baseUrl}/api/integrations/google-sheets/callback`.trim()
  // Get user's tenant ID
  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .single()

  const tenantId = userData?.tenant_id

  // Check for custom tenant credentials if user has a tenant
  if (tenantId) {
    const { data: tenantSettings } = await (supabase as any)
      .from('tenant_integration_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('provider', 'google_sheets')
      .eq('use_custom_credentials', true)
      .single()
    if (tenantSettings?.custom_client_id) {      
      let decryptedSecret = null
      
      // Try to get secret from vault first
      if (tenantSettings.client_secret_vault_id) {
        try {
          // Use RPC function to get decrypted secret
          const { data: vaultSecret } = await supabase.rpc('get_integration_secret', {
            p_tenant_id: tenantId,
            p_provider: 'google_sheets',
            p_secret_type: 'client_secret',
          })
          
          if (vaultSecret) {
            decryptedSecret = vaultSecret
            console.log('[Google Sheets OAuth] Retrieved secret from vault')
          }
        } catch (error) {
          console.error('Failed to retrieve secret from vault:', error)
        }
      }
      
      // Fall back to legacy encrypted secret
      if (!decryptedSecret && tenantSettings.custom_client_secret) {
        try {
          decryptedSecret = decrypt(tenantSettings.custom_client_secret)
          console.log('[Google Sheets OAuth] Retrieved secret from legacy encryption')
        } catch (error) {
          console.error('Failed to decrypt client secret:', error)
        }
      }

      if (decryptedSecret) {
        const finalRedirectUri = (tenantSettings.custom_redirect_uri?.trim() || defaultRedirectUri).trim()        return {
          clientId: tenantSettings.custom_client_id,
          clientSecret: decryptedSecret,
          redirectUri: finalRedirectUri,
          source: 'tenant',
        }
      }
    }
  }

  // Fall back to platform-level environment variables
  // Check both GOOGLE_REDIRECT_URI and GOOGLE_SHEETS_REDIRECT_URI
  const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  const googleSheetsRedirectUri = process.env.GOOGLE_SHEETS_REDIRECT_URI?.trim();  const platformRedirectUri = (googleSheetsRedirectUri || googleRedirectUri || defaultRedirectUri).trim()  return {
    clientId: process.env.GOOGLE_CLIENT_ID || null,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
    redirectUri: platformRedirectUri,
    source: 'platform',
  }
}

export async function GET() {
  try {    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get credentials (checks tenant settings first, then env vars)
    const credentials = await getGoogleCredentials(supabase, user.id)

    if (!credentials.clientId) {
      return NextResponse.json({
        error: 'Google Sheets integration not configured',
        message: 'Please contact the administrator to set up Google Sheets integration, or configure your own credentials in Settings.',
        configurationRequired: true,
      }, { status: 503 })
    }

    // Generate state parameter for CSRF protection
    // Include credential source in state so callback knows which credentials to use
    const state = Buffer.from(JSON.stringify({
      userId: user.id,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(7),
      credentialSource: credentials.source,
    })).toString('base64')

    // Store state in database for verification
    await (supabase as any)
      .from('oauth_states')
      .upsert({
        user_id: user.id,
        state,
        provider: 'google_sheets',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      })

    // Build Google OAuth URL
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
    ]

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', credentials.clientId)
    authUrl.searchParams.set('redirect_uri', credentials.redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', scopes.join(' '))
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')
    authUrl.searchParams.set('state', state)

    // Log redirect URI for debugging (don't log full URL with state for security)
    console.log('[Google Sheets OAuth] Redirect URI:', credentials.redirectUri)
    console.log('[Google Sheets OAuth] Client ID:', credentials.clientId?.substring(0, 20) + '...')
    console.log('[Google Sheets OAuth] Credential Source:', credentials.source)    return NextResponse.json({ 
      authUrl: authUrl.toString(),
      credentialSource: credentials.source,
      redirectUri: credentials.redirectUri, // Include in response for debugging    })
  } catch (error) {
    console.error('Error generating auth URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate authentication URL' },
      { status: 500 }
    )
  }
}
