import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import crypto from "crypto";

const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY;
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET;
const DROPBOX_REDIRECT_URI = process.env.DROPBOX_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/storage/dropbox/callback`;

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
    const storedState = request.cookies.get("dropbox_oauth_state")?.value;

    // Verify state
    if (!state || state !== storedState) {
      return NextResponse.redirect("/upload?error=invalid_state");
    }

    if (!code) {
      return NextResponse.redirect("/upload?error=no_code");
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://api.dropbox.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: DROPBOX_REDIRECT_URI,
        client_id: DROPBOX_APP_KEY!,
        client_secret: DROPBOX_APP_SECRET!,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      console.error("Token exchange error:", error);
      return NextResponse.redirect("/upload?error=token_exchange_failed");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;

    // Encrypt tokens before storing
    const encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
    const encryptedAccessToken = encrypt(accessToken, encryptionKey);
    const encryptedRefreshToken = refreshToken ? encrypt(refreshToken, encryptionKey) : null;

    // Get tenant_id
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    // Store connection in database
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : null;

    const { error: insertError } = await supabase
      .from("cloud_storage_connections")
      .upsert({
        user_id: user.id,
        tenant_id: userData?.tenant_id || null,
        provider: "dropbox",
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
    const response = NextResponse.redirect("/upload?connected=dropbox");
    response.cookies.delete("dropbox_oauth_state");

    return response;
  } catch (error: any) {
    console.error("Dropbox callback error:", error);
    return NextResponse.redirect("/upload?error=callback_failed");
  }
}
