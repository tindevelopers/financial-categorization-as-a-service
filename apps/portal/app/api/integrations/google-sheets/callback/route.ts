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

function decrypt(encryptedText: string, key: string): string {
  const parts = encryptedText.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted text format");
  }
  const [ivHex, ciphertext] = parts;
  const algorithm = "aes-256-cbc";
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(
    algorithm,
    Buffer.from(key, "hex"),
    iv
  );
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect("/dashboard/integrations/google-sheets?error=unauthorized");
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const storedState = request.cookies.get("google_sheets_oauth_state")?.value;

    // Verify state
    if (!state || state !== storedState) {
      return NextResponse.redirect("/dashboard/integrations/google-sheets?error=invalid_state");
    }

    if (!code) {
      return NextResponse.redirect("/dashboard/integrations/google-sheets?error=no_code");
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
      return NextResponse.redirect("/dashboard/integrations/google-sheets?error=no_credentials");
    }

    // Exchange code for tokens using googleapis
    const oauth2Client = new google.auth.OAuth2(
      oauthCreds.clientId,
      oauthCreds.clientSecret,
      oauthCreds.redirectUri
    );


    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      return NextResponse.redirect("/dashboard/integrations/google-sheets?error=no_access_token");
    }

    // Get user info to get email
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const providerEmail = userInfo.data.email || null;

    // Encrypt tokens before storing
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      console.error("ENCRYPTION_KEY not configured");
      return NextResponse.redirect("/dashboard/integrations/google-sheets?error=configuration_error");
    }
    
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

    // Store connection in database - try both tables for compatibility
    const { error: insertError1 } = await supabase
      .from("cloud_storage_connections")
      .upsert({
        user_id: user.id,
        tenant_id: userData?.tenant_id || null,
        provider: "google_sheets",
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_expires_at: expiresAt,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,provider",
      });

    // Also store in user_integrations for compatibility
    const { error: insertError2 } = await supabase
      .from("user_integrations")
      .upsert({
        user_id: user.id,
        provider: "google_sheets",
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        provider_email: providerEmail,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,provider",
      });

    if (insertError1 && insertError2) {
      console.error("Database insert errors:", insertError1, insertError2);
      return NextResponse.redirect("/dashboard/integrations/google-sheets?error=database_error");
    }

    // Clear state cookie
    const response = NextResponse.redirect("/dashboard/integrations/google-sheets?connected=true");
    response.cookies.delete("google_sheets_oauth_state");

    return response;
  } catch (error: any) {
    console.error("Google Sheets callback error:", error);
    return NextResponse.redirect("/dashboard/integrations/google-sheets?error=callback_failed");
  }
}
