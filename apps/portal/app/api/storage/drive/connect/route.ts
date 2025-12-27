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

    // Get OAuth credentials from credential manager (prefers tenant-specific if available)
    const credentialManager = getCredentialManager();
    const oauthCreds = await credentialManager.getBestGoogleOAuth(userData?.tenant_id || undefined);

    if (!oauthCreds) {
      return NextResponse.json(
        { error: "Google Drive app not configured" },
        { status: 500 }
      );
    }

    // Use Google Drive redirect URI (different from Google Sheets)
    const driveRedirectUri = process.env.GOOGLE_REDIRECT_URI || 
      `${process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/api/storage/drive/callback`;

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString("hex");

    // Google OAuth URL
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", oauthCreds.clientId);
    authUrl.searchParams.set("redirect_uri", driveRedirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/drive.file");
    authUrl.searchParams.set("access_type", "offline"); // Get refresh token
    authUrl.searchParams.set("prompt", "consent"); // Force consent to get refresh token
    authUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(authUrl.toString());

    // Store state in httpOnly cookie
    response.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (error: any) {
    console.error("Google Drive connect error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
