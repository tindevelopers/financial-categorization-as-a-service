import { createClient } from "@/lib/database/server";
import { google } from "googleapis";
import crypto from "crypto";

/**
 * OAuth Token Helper Module
 * 
 * Provides reusable functions for managing Google Sheets OAuth tokens:
 * - Retrieving OAuth tokens from database
 * - Decrypting tokens using ENCRYPTION_KEY
 * - Refreshing expired tokens
 * - Creating authenticated Google Sheets client
 */

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

/**
 * Decrypt an encrypted token string
 */
export function decryptToken(encryptedText: string): string {
  if (!encryptedText) {
    throw new Error("Encrypted text is empty");
  }
  
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY not configured");
  }
  
  const parts = encryptedText.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted text format");
  }
  
  const [ivHex, ciphertext] = parts;
  const algorithm = "aes-256-cbc";
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(
    algorithm,
    Buffer.from(encryptionKey, "hex"),
    iv
  );
  
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Retrieve and decrypt OAuth tokens for a user
 * Checks both cloud_storage_connections and user_integrations tables
 */
export async function getUserOAuthTokens(userId: string): Promise<OAuthTokens | null> {
  const supabase = await createClient();
  
  // Try cloud_storage_connections table first
  const { data: connection } = await supabase
    .from("cloud_storage_connections")
    .select("access_token_encrypted, refresh_token_encrypted, token_expires_at")
    .eq("user_id", userId)
    .eq("provider", "google_sheets")
    .eq("is_active", true)
    .single();
  
  // Try user_integrations table as fallback
  const { data: integration } = await supabase
    .from("user_integrations")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "google_sheets")
    .single();
  
  // Determine which source to use
  const hasConnection = connection?.access_token_encrypted;
  const hasIntegration = integration?.access_token;
  
  if (!hasConnection && !hasIntegration) {
    return null;
  }
  
  try {
    let accessToken: string;
    let refreshToken: string | null = null;
    let expiresAt: Date | null = null;
    
    if (hasConnection) {
      accessToken = decryptToken(connection.access_token_encrypted);
      refreshToken = connection.refresh_token_encrypted 
        ? decryptToken(connection.refresh_token_encrypted)
        : null;
      expiresAt = connection.token_expires_at 
        ? new Date(connection.token_expires_at)
        : null;
    } else if (hasIntegration) {
      accessToken = decryptToken(integration.access_token);
      refreshToken = integration.refresh_token 
        ? decryptToken(integration.refresh_token)
        : null;
      expiresAt = integration.expires_at 
        ? new Date(integration.expires_at)
        : null;
    } else {
      return null;
    }
    
    return {
      accessToken,
      refreshToken,
      expiresAt,
    };
  } catch (error: any) {
    console.error("Failed to decrypt OAuth tokens:", error.message);
    return null;
  }
}

/**
 * Refresh an expired OAuth token
 */
export async function refreshOAuthToken(
  accessToken: string,
  refreshToken: string | null
): Promise<OAuthTokens> {
  if (!refreshToken) {
    throw new Error("Refresh token not available. User needs to reconnect.");
  }
  
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const GOOGLE_SHEETS_REDIRECT_URI = process.env.GOOGLE_SHEETS_REDIRECT_URI || 
    process.env.GOOGLE_REDIRECT_URI || 
    `${baseUrl}/api/integrations/google-sheets/callback`;
  
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials not configured");
  }
  
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_SHEETS_REDIRECT_URI
  );
  
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });
  
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    if (!credentials.access_token) {
      throw new Error("Failed to refresh access token");
    }
    
    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token || refreshToken,
      expiresAt: credentials.expiry_date 
        ? new Date(credentials.expiry_date)
        : null,
    };
  } catch (error: any) {
    console.error("Token refresh failed:", error);
    throw new Error(`Token refresh failed: ${error.message}`);
  }
}

/**
 * Create an authenticated Google Sheets client with automatic token refresh
 * Returns the client and the authentication method used
 */
export async function createOAuthSheetsClient(
  userId: string
): Promise<{
  sheets: ReturnType<typeof google.sheets>;
  auth: any;
  tokens: OAuthTokens;
}> {
  // Get user's OAuth tokens
  let tokens = await getUserOAuthTokens(userId);
  
  if (!tokens) {
    throw new Error("No Google Sheets connection found. Please connect your Google account in Settings > Integrations.");
  }
  
  // Check if token is expired and refresh if needed
  if (tokens.expiresAt && tokens.expiresAt < new Date()) {
    if (!tokens.refreshToken) {
      throw new Error("Your Google account connection has expired. Please reconnect in Settings > Integrations.");
    }
    
    try {
      tokens = await refreshOAuthToken(tokens.accessToken, tokens.refreshToken);
      console.log("Google Sheets: Refreshed expired OAuth token");
    } catch (error: any) {
      throw new Error("Your Google account connection has expired. Please reconnect in Settings > Integrations.");
    }
  }
  
  // Create OAuth2 client
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const GOOGLE_SHEETS_REDIRECT_URI = process.env.GOOGLE_SHEETS_REDIRECT_URI || 
    process.env.GOOGLE_REDIRECT_URI || 
    `${baseUrl}/api/integrations/google-sheets/callback`;
  
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials not configured");
  }
  
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_SHEETS_REDIRECT_URI
  );
  
  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken || undefined,
  });
  
  const sheets = google.sheets({ version: "v4", auth: oauth2Client });
  
  return {
    sheets,
    auth: oauth2Client,
    tokens,
  };
}

/**
 * Check if user has Google Sheets OAuth connection
 */
export async function hasGoogleSheetsConnection(userId: string): Promise<boolean> {
  const tokens = await getUserOAuthTokens(userId);
  return tokens !== null;
}

