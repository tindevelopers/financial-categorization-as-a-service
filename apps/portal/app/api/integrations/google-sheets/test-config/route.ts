import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { getCredentialManager } from "@/lib/credentials/VercelCredentialManager";
import { validateOAuthConfig } from "@/lib/google-sheets/oauth-config";

/**
 * GET /api/integrations/google-sheets/test-config
 * Test endpoint to check OAuth configuration (for debugging)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get tenant_id
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const tenantId = userData?.tenant_id || undefined;

    // Validate OAuth configuration
    const configValidation = await validateOAuthConfig(tenantId);
    
    // Get credentials
    const credentialManager = getCredentialManager();
    const oauthCreds = await credentialManager.getBestGoogleOAuth(tenantId);

    // Get environment info
    const envInfo = {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "not set",
      VERCEL_URL: process.env.VERCEL_URL || "not set",
      PORT: process.env.PORT || "not set",
      GOOGLE_SHEETS_REDIRECT_URI: process.env.GOOGLE_SHEETS_REDIRECT_URI || "not set",
      GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || "not set",
      NODE_ENV: process.env.NODE_ENV || "not set",
      hasGOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      hasGOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    };

    return NextResponse.json({
      success: true,
      configValidation,
      oauthCredentials: {
        hasClientId: !!oauthCreds?.clientId,
        clientIdPreview: oauthCreds?.clientId ? `${oauthCreds.clientId.substring(0, 20)}...` : null,
        redirectUri: oauthCreds?.redirectUri || null,
        hasRedirectUri: !!oauthCreds?.redirectUri,
      },
      environment: envInfo,
      tenantId: tenantId || null,
      recommendation: configValidation.isValid 
        ? "Configuration looks good! Make sure the redirect URI matches Google Cloud Console."
        : "Configuration has errors. Check the errors array for details.",
    });
  } catch (error: any) {
    console.error("Test config error:", error);
    return NextResponse.json(
      { 
        error: error.message || "Internal server error",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

