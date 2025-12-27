import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { getCredentialManager } from "@/lib/credentials/VercelCredentialManager";
import crypto from "crypto";

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

    // Get tenant_id for tenant-specific credentials
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const credentialManager = getCredentialManager();

    // Check for OAuth credentials (required for user-level connections)
    // Try tenant-specific credentials first, then fall back to platform credentials
    const oauthCreds = await credentialManager.getBestGoogleOAuth(userData?.tenant_id || undefined);
    const hasOAuthCredentials = oauthCreds !== null;
    
    // Check for service account credentials (alternative method for server-level access)
    const hasServiceAccountCredentials = await credentialManager.hasGoogleServiceAccount();

    if (!hasOAuthCredentials && !hasServiceAccountCredentials) {
      return NextResponse.json(
        { 
          error: "Google Sheets integration not configured. Please contact your administrator.",
          details: "Neither OAuth credentials (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET) nor service account credentials (GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) are configured."
        },
        { status: 500 }
      );
    }

    // If only service account is configured, explain that OAuth is needed for user connections
    if (!hasOAuthCredentials && hasServiceAccountCredentials) {
      return NextResponse.json(
        { 
          error: "Google Sheets OAuth is not configured. Service account credentials are present, but user-level OAuth connection requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
          details: "Export functionality may work with service account credentials, but user-level Google Sheets access requires OAuth setup.",
          serviceAccountConfigured: true
        },
        { status: 500 }
      );
    }

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString("hex");

    // Google OAuth URL - use credentials from credential manager
    if (!oauthCreds) {
      return NextResponse.json(
        { error: "Google Sheets integration not configured. Please contact your administrator." },
        { status: 500 }
      );
    }
    
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", oauthCreds.clientId);
    authUrl.searchParams.set("redirect_uri", oauthCreds.redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/userinfo.email"
    ].join(" "));
    authUrl.searchParams.set("access_type", "offline"); // Get refresh token
    authUrl.searchParams.set("prompt", "consent"); // Force consent to get refresh token
    authUrl.searchParams.set("state", state);


    const response = NextResponse.redirect(authUrl.toString());

    // Store state in httpOnly cookie
    response.cookies.set("google_sheets_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (error: any) {
    console.error("Google Sheets connect error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

