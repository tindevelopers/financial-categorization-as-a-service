import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { getCredentialManager } from "@/lib/credentials/VercelCredentialManager";
import { google } from "googleapis";
import crypto from "crypto";

function encrypt(text: string, key: string): string {
  const algorithm = "aes-256-cbc";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    algorithm,
    Buffer.from(key, "hex"),
    iv
  );
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect("/upload?error=unauthorized");
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const storedState = request.cookies.get("google_oauth_state")?.value;

    // Verify state
    if (!state || state !== storedState) {
      return NextResponse.redirect("/upload?error=invalid_state");
    }

    if (!code) {
      return NextResponse.redirect("/upload?error=no_code");
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
      return NextResponse.redirect("/upload?error=no_credentials");
    }

    // Use Google Drive redirect URI (different from Google Sheets)
    const driveRedirectUri = process.env.GOOGLE_REDIRECT_URI || 
      `${process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/api/storage/drive/callback`;

    // Exchange code for tokens using googleapis
    const oauth2Client = new google.auth.OAuth2(
      oauthCreds.clientId,
      oauthCreds.clientSecret,
      driveRedirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      return NextResponse.redirect("/upload?error=no_access_token");
    }

    // Encrypt tokens before storing
    const encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
    const encryptedAccessToken = encrypt(tokens.access_token, encryptionKey);
    const encryptedRefreshToken = tokens.refresh_token 
      ? encrypt(tokens.refresh_token, encryptionKey) 
      : null;

    // Calculate expiration
    const expiresAt = tokens.expiry_date 
      ? new Date(tokens.expiry_date)
      : tokens.access_token 
        ? new Date(Date.now() + 3600 * 1000) // Default 1 hour
        : null;

    // Store connection in database
    const { error: insertError } = await supabase
      .from("cloud_storage_connections")
      .upsert({
        user_id: user.id,
        tenant_id: userData?.tenant_id || null,
        provider: "google_drive",
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_expires_at: expiresAt,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,provider",
      });

    if (insertError) {
      console.error("Database insert error:", insertError);
      return NextResponse.redirect("/upload?error=database_error");
    }

    // Clear state cookie
    const response = NextResponse.redirect("/upload?connected=google_drive");
    response.cookies.delete("google_oauth_state");

    return response;
  } catch (error: any) {
    console.error("Google Drive callback error:", error);
    return NextResponse.redirect("/upload?error=callback_failed");
  }
}
