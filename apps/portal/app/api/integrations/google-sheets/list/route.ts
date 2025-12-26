import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { google } from "googleapis";
import crypto from "crypto";

/**
 * GET /api/integrations/google-sheets/list
 * List all Google Sheets that the user has access to
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

    // Check if user has Google Sheets integration
    // Try both tables - user_integrations and cloud_storage_connections
    const { data: integration } = await supabase
      .from("user_integrations")
      .select("access_token, refresh_token, provider_email, provider, expires_at")
      .eq("user_id", user.id)
      .eq("provider", "google_sheets")
      .single();

    const { data: connection } = await supabase
      .from("cloud_storage_connections")
      .select("access_token_encrypted, refresh_token_encrypted, provider, token_expires_at")
      .eq("user_id", user.id)
      .eq("provider", "google_sheets")
      .eq("is_active", true)
      .single();

    if (!integration && !connection) {
      return NextResponse.json(
        { 
          error: "Google Sheets not connected",
          error_code: "NOT_CONNECTED"
        },
        { status: 400 }
      );
    }

    // Helper function to decrypt tokens
    const decryptToken = (encryptedText: string): string => {
      if (!encryptedText) return "";
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
    };

    let auth;
    let sheets: ReturnType<typeof google.sheets>;

    // Try to use OAuth credentials first (from user's connection)
    try {
      let accessToken: string | null = null;
      let refreshToken: string | null = null;
      let expiresAt: Date | null = null;

      // Get tokens from either table
      if (integration?.access_token) {
        accessToken = decryptToken(integration.access_token);
        refreshToken = integration.refresh_token ? decryptToken(integration.refresh_token) : null;
        expiresAt = integration.expires_at ? new Date(integration.expires_at) : null;
      } else if (connection?.access_token_encrypted) {
        accessToken = decryptToken(connection.access_token_encrypted);
        refreshToken = connection.refresh_token_encrypted ? decryptToken(connection.refresh_token_encrypted) : null;
        expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
      }

      if (!accessToken) {
        return NextResponse.json(
          { 
            error: "Failed to retrieve access token",
            error_code: "TOKEN_ERROR"
          },
          { status: 500 }
        );
      }

      // Check if token is expired and refresh if needed
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_SHEETS_REDIRECT_URI || 
        process.env.GOOGLE_REDIRECT_URI || 
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/google-sheets/callback`
      );

      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken || undefined,
      });

      // Refresh token if expired
      if (expiresAt && expiresAt < new Date()) {
        if (refreshToken) {
          try {
            const { credentials } = await oauth2Client.refreshAccessToken();
            accessToken = credentials.access_token || accessToken;
            // Update stored token (simplified - in production, update database)
          } catch (refreshError) {
            console.error("Token refresh failed:", refreshError);
            return NextResponse.json(
              { 
                error: "Token expired and refresh failed. Please reconnect.",
                error_code: "TOKEN_EXPIRED"
              },
              { status: 401 }
            );
          }
        } else {
          return NextResponse.json(
            { 
              error: "Token expired. Please reconnect.",
              error_code: "TOKEN_EXPIRED"
            },
            { status: 401 }
          );
        }
      }

      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken || undefined,
      });

      auth = oauth2Client;

      sheets = google.sheets({ version: "v4", auth });
      const drive = google.drive({ version: "v3", auth });

      // List spreadsheets from Google Drive
      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        fields: "files(id, name, createdTime, modifiedTime, webViewLink, owners)",
        orderBy: "modifiedTime desc",
        pageSize: 100,
      });

      const spreadsheetFiles = response.data.files || [];

      // For each spreadsheet, get its sheets/tabs
      const spreadsheetsWithTabs = await Promise.all(
        spreadsheetFiles.map(async (file) => {
          try {
            const spreadsheet = await sheets.spreadsheets.get({
              spreadsheetId: file.id!,
              fields: "properties.title,sheets.properties",
            });

            const tabs = spreadsheet.data.sheets?.map((sheet) => ({
              id: sheet.properties?.sheetId?.toString() || "",
              title: sheet.properties?.title || "Untitled",
              index: sheet.properties?.index || 0,
            })) || [];

            return {
              id: file.id!,
              name: file.name || "Untitled Spreadsheet",
              url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`,
              createdTime: file.createdTime,
              modifiedTime: file.modifiedTime,
              tabs: tabs.sort((a, b) => a.index - b.index),
              owner: file.owners?.[0]?.emailAddress || "Unknown",
            };
          } catch (error: any) {
            console.error(`Error fetching tabs for spreadsheet ${file.id}:`, error.message);
            // Return spreadsheet without tabs if we can't fetch them
            return {
              id: file.id!,
              name: file.name || "Untitled Spreadsheet",
              url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`,
              createdTime: file.createdTime,
              modifiedTime: file.modifiedTime,
              tabs: [],
              owner: file.owners?.[0]?.emailAddress || "Unknown",
              error: error.message,
            };
          }
        })
      );

      return NextResponse.json({
        success: true,
        spreadsheets: spreadsheetsWithTabs,
        count: spreadsheetsWithTabs.length,
      });
    } catch (error: any) {
      console.error("Error listing Google Sheets:", error);
      return NextResponse.json(
        { 
          error: error.message || "Failed to list Google Sheets",
          error_code: "API_ERROR"
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Google Sheets list error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

