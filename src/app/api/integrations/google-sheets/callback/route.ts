import { createClient } from '@/core/database/server'
import { NextResponse } from 'next/server'
import { decrypt } from '@/lib/encryption'

/**
 * Get Google OAuth credentials based on source
 */
async function getGoogleCredentials(
  supabase: any, 
  userId: string, 
  source: 'tenant' | 'platform'
): Promise<{
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string;
}> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  const defaultRedirectUri = `${baseUrl}/api/integrations/google-sheets/callback`

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
            redirectUri: tenantSettings.custom_redirect_uri || defaultRedirectUri,
          }
        }
      }
    }
  }

  // Fall back to platform-level environment variables
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || null,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || defaultRedirectUri,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  if (error) {
    console.error('OAuth error:', error)
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?error=oauth_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?error=invalid_callback`)
  }

  try {
    const supabase = await createClient()
    
    // Verify state and get user
    const { data: oauthState, error: stateError } = await (supabase as any)
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .eq('provider', 'google_sheets')
      .single()

    if (stateError || !oauthState) {
      console.error('Invalid OAuth state:', stateError)
      return NextResponse.redirect(`${baseUrl}/dashboard/settings?error=invalid_state`)
    }

    // Check if state is expired
    if (new Date(oauthState.expires_at) < new Date()) {
      return NextResponse.redirect(`${baseUrl}/dashboard/settings?error=state_expired`)
    }

    const userId = oauthState.user_id

    // Parse the state to get credential source
    let credentialSource: 'tenant' | 'platform' = 'platform'
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      credentialSource = stateData.credentialSource || 'platform'
    } catch (e) {
      console.error('Failed to parse state:', e)
    }

    // Get the appropriate credentials
    const credentials = await getGoogleCredentials(supabase, userId, credentialSource)

    if (!credentials.clientId || !credentials.clientSecret) {
      return NextResponse.redirect(`${baseUrl}/dashboard/settings?error=configuration_error`)
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: credentials.redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Token exchange failed:', errorData)
      return NextResponse.redirect(`${baseUrl}/dashboard/settings?error=token_exchange_failed`)
    }

    const tokens = await tokenResponse.json()

    // Get user's email from Google
    let providerEmail = null
    try {
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json()
        providerEmail = userInfo.email
      }
    } catch (e) {
      console.error('Failed to get user info:', e)
    }

    // Store tokens in database
    const { error: upsertError } = await (supabase as any)
      .from('user_integrations')
      .upsert({
        user_id: userId,
        provider: 'google_sheets',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokens.expires_in 
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
        provider_email: providerEmail,
        metadata: {
          credential_source: credentialSource,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider',
      })

    if (upsertError) {
      console.error('Failed to store tokens:', upsertError)
      return NextResponse.redirect(`${baseUrl}/dashboard/settings?error=storage_failed`)
    }

    // Clean up OAuth state
    await (supabase as any)
      .from('oauth_states')
      .delete()
      .eq('state', state)

    return NextResponse.redirect(`${baseUrl}/dashboard/settings?success=google_sheets_connected`)
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?error=callback_failed`)
  }
}
