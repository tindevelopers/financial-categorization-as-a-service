import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { google } from "googleapis";
import crypto from "crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/storage/drive/callback`;

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

    // Exchange code for tokens using googleapis
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
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

    // Get tenant_id
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

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
