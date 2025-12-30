/**
 * Test Enterprise OAuth Credentials
 * 
 * Admin-only endpoint for testing OAuth credentials for Enterprise tenants.
 * Verifies that the credentials are valid and can generate an OAuth URL.
 */

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";

// Encryption helpers
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-32-char-key-for-dev-only";

function decrypt(encryptedText: string): string {
  try {
    const [ivHex, encrypted] = encryptedText.split(":");
    if (!ivHex || !encrypted) return encryptedText;
    const iv = Buffer.from(ivHex, "hex");
    const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return encryptedText;
  }
}

// Create Supabase client for the current user
async function createClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore
          }
        },
      },
    }
  );
}

// Create admin client
function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Check if user is a Platform Admin
async function isPlatformAdmin(supabase: ReturnType<typeof createServerClient>): Promise<boolean> {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) return false;
  
  const adminClient = getAdminClient();
  const { data: userData } = await adminClient
    .from("users")
    .select("role_id, roles:role_id (name)")
    .eq("id", user.id)
    .single();
  
  return (userData?.roles as any)?.name === "Platform Admin";
}

/**
 * POST - Test OAuth credentials for an enterprise tenant
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Verify Platform Admin access
    const isAdmin = await isPlatformAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized. Platform Admin access required." },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { tenant_id, provider } = body;
    
    if (!tenant_id || !provider) {
      return NextResponse.json(
        { error: "tenant_id and provider are required" },
        { status: 400 }
      );
    }
    
    const adminClient = getAdminClient();
    
    // Get the OAuth configuration
    const { data: config, error: configError } = await adminClient
      .from("tenant_integration_settings")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("provider", provider)
      .single();
    
    if (configError || !config) {
      return NextResponse.json({
        valid: false,
        message: "No OAuth configuration found for this tenant",
      });
    }
    
    // Check if required fields are present
    if (!config.custom_client_id) {
      return NextResponse.json({
        valid: false,
        message: "Client ID is not configured",
      });
    }
    
    if (!config.custom_client_secret && !config.client_secret_vault_id) {
      return NextResponse.json({
        valid: false,
        message: "Client Secret is not configured",
      });
    }
    
    // Decrypt client secret if stored in database
    let clientSecret = "";
    if (config.custom_client_secret) {
      clientSecret = decrypt(config.custom_client_secret);
    }
    
    // Validate client ID format
    if (!config.custom_client_id.includes(".apps.googleusercontent.com")) {
      return NextResponse.json({
        valid: false,
        message: "Client ID format appears invalid (should end with .apps.googleusercontent.com)",
      });
    }
    
    // Try to construct an OAuth URL to verify the credentials format
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      const redirectUri = config.custom_redirect_uri || 
        `${baseUrl}/api/integrations/google-sheets/callback`;
      
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", config.custom_client_id);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file");
      authUrl.searchParams.set("access_type", "offline");
      
      // If we can construct the URL, the basic format is valid
      return NextResponse.json({
        valid: true,
        message: "Credentials format is valid. OAuth URL can be generated.",
        oauthUrl: authUrl.toString(),
        redirectUri,
      });
      
    } catch (urlError) {
      return NextResponse.json({
        valid: false,
        message: "Failed to construct OAuth URL with provided credentials",
      });
    }
    
  } catch (error) {
    console.error("Error in POST /api/enterprise/oauth-credentials/test:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


