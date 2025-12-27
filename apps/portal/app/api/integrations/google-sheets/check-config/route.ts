import { NextRequest, NextResponse } from "next/server";
import { getCredentialManager } from "@/lib/credentials/VercelCredentialManager";

/**
 * GET /api/integrations/google-sheets/check-config
 * Diagnostic endpoint to check which Google Sheets credentials are configured
 * This helps debug configuration issues
 */
export async function GET(request: NextRequest) {
  try {
    const credentialManager = getCredentialManager();
    
    const oauthCreds = await credentialManager.getGoogleOAuth();
    const oauthConfigured = oauthCreds !== null;
    
    const serviceAccountCreds = await credentialManager.getGoogleServiceAccount();
    const serviceAccountConfigured = serviceAccountCreds !== null;

    return NextResponse.json({
      oauth: {
        configured: oauthConfigured,
        hasClientId: !!oauthCreds?.clientId,
        hasClientSecret: !!oauthCreds?.clientSecret,
        redirectUri: oauthCreds?.redirectUri || 'not configured',
        purpose: "Individual user-level OAuth connections",
      },
      serviceAccount: {
        configured: serviceAccountConfigured,
        hasEmail: !!serviceAccountCreds?.email,
        hasPrivateKey: !!serviceAccountCreds?.privateKey,
        purpose: "Corporate/Company-level server-to-server API access",
      },
      summary: {
        exportWillWork: serviceAccountConfigured,
        oauthConnectWillWork: oauthConfigured,
        fullyConfigured: oauthConfigured && serviceAccountConfigured,
      },
      recommendations: {
        forExport: serviceAccountConfigured 
          ? "✅ Export should work with service account credentials (corporate/company level)" 
          : "❌ Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY for corporate export",
        forOAuth: oauthConfigured 
          ? "✅ OAuth connect should work for individual user connections" 
          : "❌ Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for OAuth user connections",
        note: "Corporate/Company level uses Service Account credentials. Individual level uses OAuth credentials (requires user OAuth flow)."
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to check configuration" },
      { status: 500 }
    );
  }
}

