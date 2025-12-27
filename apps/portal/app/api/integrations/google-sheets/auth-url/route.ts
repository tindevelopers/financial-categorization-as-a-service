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
  // #region agent log - Check env vars for whitespace
  const nextPublicAppUrlRaw = process.env.NEXT_PUBLIC_APP_URL;
  const vercelUrlRaw = process.env.VERCEL_URL;
  const googleRedirectUriRaw = process.env.GOOGLE_REDIRECT_URI;
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/integrations/google-sheets/auth-url/route.ts:getGoogleCredentials:env',message:'Environment variables before trim',data:{nextPublicAppUrlRaw,nextPublicAppUrlLength:nextPublicAppUrlRaw?.length,nextPublicAppUrlHasTrailingWs:nextPublicAppUrlRaw?.[nextPublicAppUrlRaw.length-1]===' '||nextPublicAppUrlRaw?.[nextPublicAppUrlRaw.length-1]==='\n',vercelUrlRaw,googleRedirectUriRaw,googleRedirectUriLength:googleRedirectUriRaw?.length,googleRedirectUriHasTrailingWs:googleRedirectUriRaw?.[googleRedirectUriRaw?.length-1]===' '||googleRedirectUriRaw?.[googleRedirectUriRaw?.length-1]==='\n'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  const nextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const vercelUrl = process.env.VERCEL_URL?.trim();
  // #region agent log - Check base URL construction inputs
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/integrations/google-sheets/auth-url/route.ts:getGoogleCredentials:baseUrlInputs',message:'Base URL construction inputs',data:{nextPublicAppUrl,vercelUrl,hasNextPublicAppUrl:!!nextPublicAppUrl,hasVercelUrl:!!vercelUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  const baseUrl = (nextPublicAppUrl || 
    (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3000')).trim()
  const defaultRedirectUri = `${baseUrl}/api/integrations/google-sheets/callback`.trim()
  
  // #region agent log - Check constructed defaultRedirectUri
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/integrations/google-sheets/auth-url/route.ts:getGoogleCredentials:defaultRedirectUri',message:'Default redirect URI after construction',data:{defaultRedirectUri,defaultRedirectUriLength:defaultRedirectUri.length,hasTrailingWs:defaultRedirectUri[defaultRedirectUri.length-1]===' '||defaultRedirectUri[defaultRedirectUri.length-1]==='\n',baseUrl,baseUrlLength:baseUrl.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

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

    // #region agent log - Debug tenant settings
    console.log('[DEBUG] Tenant settings lookup:', JSON.stringify({
      tenantId,
      hasSettings: !!tenantSettings,
      useCustomCredentials: tenantSettings?.use_custom_credentials,
      customRedirectUri: tenantSettings?.custom_redirect_uri || '(not set)',
      hasCustomClientId: !!tenantSettings?.custom_client_id,
    }));
    // #endregion

    if (tenantSettings?.custom_client_id) {
      // #region agent log - Check database custom_redirect_uri for whitespace
      const customRedirectUriRaw = tenantSettings.custom_redirect_uri;
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/integrations/google-sheets/auth-url/route.ts:getGoogleCredentials:customRedirectUri',message:'Database custom_redirect_uri before trim',data:{customRedirectUriRaw,customRedirectUriLength:customRedirectUriRaw?.length,customRedirectUriHasTrailingWs:customRedirectUriRaw?.[customRedirectUriRaw?.length-1]===' '||customRedirectUriRaw?.[customRedirectUriRaw?.length-1]==='\n',defaultRedirectUri},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
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
        const finalRedirectUri = (tenantSettings.custom_redirect_uri?.trim() || defaultRedirectUri).trim()
        // #region agent log - Check final redirect URI before return
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/integrations/google-sheets/auth-url/route.ts:getGoogleCredentials:finalRedirectUri',message:'Final redirect URI before return (tenant)',data:{finalRedirectUri,finalRedirectUriLength:finalRedirectUri.length,hasTrailingWs:finalRedirectUri[finalRedirectUri.length-1]===' '||finalRedirectUri[finalRedirectUri.length-1]==='\n'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        return {
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
  const googleSheetsRedirectUri = process.env.GOOGLE_SHEETS_REDIRECT_URI?.trim();
  // #region agent log - Check which redirect URI env vars are available
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/integrations/google-sheets/auth-url/route.ts:getGoogleCredentials:checkEnvVars',message:'Checking redirect URI environment variables',data:{hasGoogleRedirectUri:!!googleRedirectUri,hasGoogleSheetsRedirectUri:!!googleSheetsRedirectUri,googleRedirectUri,googleSheetsRedirectUri,defaultRedirectUri},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  const platformRedirectUri = (googleSheetsRedirectUri || googleRedirectUri || defaultRedirectUri).trim()
  // #region agent log - Check platform redirect URI before return
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/integrations/google-sheets/auth-url/route.ts:getGoogleCredentials:platformRedirectUri',message:'Final redirect URI before return (platform)',data:{platformRedirectUri,platformRedirectUriLength:platformRedirectUri.length,hasTrailingWs:platformRedirectUri[platformRedirectUri.length-1]===' '||platformRedirectUri[platformRedirectUri.length-1]==='\n',defaultRedirectUri,usedEnvVar:googleSheetsRedirectUri?'GOOGLE_SHEETS_REDIRECT_URI':googleRedirectUri?'GOOGLE_REDIRECT_URI':'defaultRedirectUri'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || null,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
    redirectUri: platformRedirectUri,
    source: 'platform',
  }
}

export async function GET() {
  try {
    // #region agent log - Debug environment variables for Vercel
    const debugEnvInfo = {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '(not set)',
      VERCEL_URL: process.env.VERCEL_URL || '(not set)',
      GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '(not set)',
      GOOGLE_SHEETS_REDIRECT_URI: process.env.GOOGLE_SHEETS_REDIRECT_URI || '(not set)',
      GOOGLE_CLIENT_ID_PREFIX: process.env.GOOGLE_CLIENT_ID?.substring(0, 25) || '(not set)',
      NODE_ENV: process.env.NODE_ENV,
    };
    console.log('[DEBUG] Auth URL endpoint - Environment:', JSON.stringify(debugEnvInfo));
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/integrations/google-sheets/auth-url/route.ts:GET:envCheck',message:'Environment variables at endpoint entry',data:debugEnvInfo,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const supabase = await createClient()
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
    console.log('[Google Sheets OAuth] Credential Source:', credentials.source)

    // #region agent log - Debug final credentials
    const debugCredentialsInfo = {
      redirectUri: credentials.redirectUri,
      clientIdPrefix: credentials.clientId?.substring(0, 25),
      source: credentials.source,
    };
    console.log('[DEBUG] Final credentials:', JSON.stringify(debugCredentialsInfo));
    // #endregion

    // #region agent log - Log final redirect URI being used
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/integrations/google-sheets/auth-url/route.ts:GET:finalRedirectUri',message:'Final redirect URI being sent to Google',data:{redirectUri:credentials.redirectUri,credentialSource:credentials.source,envVars:{NEXT_PUBLIC_APP_URL:process.env.NEXT_PUBLIC_APP_URL,GOOGLE_SHEETS_REDIRECT_URI:process.env.GOOGLE_SHEETS_REDIRECT_URI,GOOGLE_REDIRECT_URI:process.env.GOOGLE_REDIRECT_URI,VERCEL_URL:process.env.VERCEL_URL}},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return NextResponse.json({ 
      authUrl: authUrl.toString(),
      credentialSource: credentials.source,
      redirectUri: credentials.redirectUri, // Include in response for debugging
      // #region agent log - Include debug info in response for remote debugging
      _debug: {
        envInfo: {
          NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '(not set)',
          VERCEL_URL: process.env.VERCEL_URL || '(not set)',
          GOOGLE_REDIRECT_URI_ENV: process.env.GOOGLE_REDIRECT_URI || '(not set)',
          GOOGLE_SHEETS_REDIRECT_URI_ENV: process.env.GOOGLE_SHEETS_REDIRECT_URI || '(not set)',
        },
        credentials: debugCredentialsInfo,
      },
      // #endregion
    })
  } catch (error) {
    console.error('Error generating auth URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate authentication URL' },
      { status: 500 }
    )
  }
}
