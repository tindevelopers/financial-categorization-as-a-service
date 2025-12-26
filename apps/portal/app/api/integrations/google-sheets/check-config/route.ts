import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/integrations/google-sheets/check-config
 * Diagnostic endpoint to check which Google Sheets credentials are configured
 * This helps debug configuration issues
 */
export async function GET(request: NextRequest) {
  try {
    const oauthConfigured = !!(
      process.env.GOOGLE_CLIENT_ID && 
      process.env.GOOGLE_CLIENT_SECRET
    );
    
    const serviceAccountConfigured = !!(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && 
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    );

    const redirectUri = process.env.GOOGLE_SHEETS_REDIRECT_URI || 
      process.env.GOOGLE_REDIRECT_URI || 
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/google-sheets/callback`;

    return NextResponse.json({
      oauth: {
        configured: oauthConfigured,
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        redirectUri,
        purpose: "Individual user-level OAuth connections",
      },
      serviceAccount: {
        configured: serviceAccountConfigured,
        hasEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        hasPrivateKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
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

