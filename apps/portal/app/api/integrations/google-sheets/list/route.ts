import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { getCredentialManager } from "@/lib/credentials/VercelCredentialManager";
import { google } from "googleapis";
import { createTenantGoogleClientsForRequestUser } from "@/lib/google-sheets/tenant-clients";
import { decryptToken as decryptOAuthToken } from "@/lib/google-sheets/auth-helpers";

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

    // Tier-aware listing:
    // - Consumer: list user-accessible spreadsheets (existing behavior)
    // - Business tiers: list spreadsheets from the tenant Shared Drive (company-owned)
    try {
      const tenantClients = await createTenantGoogleClientsForRequestUser();
      if (tenantClients.tier !== "consumer") {
        const driveId = tenantClients.sharedDriveId;
        if (!driveId) {
          return NextResponse.json(
            {
              error: "Company Shared Drive not provisioned yet.",
              error_code: "SHARED_DRIVE_NOT_PROVISIONED",
              guidance: "Please run Shared Drive provisioning in Company Setup.",
              helpUrl: "/dashboard/setup",
            },
            { status: 400 }
          );
        }

        const drive = tenantClients.drive;
        const sheetsApi = tenantClients.sheets;

        // List spreadsheets in the tenant Shared Drive
        const response = await drive.files.list({
          driveId,
          corpora: "drive",
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
          q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
          fields: "files(id,name,createdTime,modifiedTime,webViewLink,owners)",
          orderBy: "modifiedTime desc",
          pageSize: 100,
        });

        const spreadsheetFiles = response.data.files || [];

        const spreadsheetsWithTabs = await Promise.all(
          spreadsheetFiles.map(async (file) => {
            try {
              const spreadsheet = await sheetsApi.spreadsheets.get({
                spreadsheetId: file.id!,
                fields: "properties.title,sheets.properties",
              });

              const tabs =
                spreadsheet.data.sheets?.map((sheet) => ({
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
                owner: file.owners?.[0]?.emailAddress || "Shared Drive",
              };
            } catch (error: any) {
              return {
                id: file.id!,
                name: file.name || "Untitled Spreadsheet",
                url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`,
                createdTime: file.createdTime,
                modifiedTime: file.modifiedTime,
                tabs: [],
                owner: file.owners?.[0]?.emailAddress || "Shared Drive",
                error: error.message,
              };
            }
          })
        );

        return NextResponse.json({
          success: true,
          spreadsheets: spreadsheetsWithTabs,
          count: spreadsheetsWithTabs.length,
          connectedAccount: null,
          exportMode: "shared_drive",
          sharedDriveId: driveId,
        });
      }
    } catch (e) {
      // Fall through to legacy OAuth listing below (consumer path or missing config)
    }

    // Get tenant_id for tenant-specific credentials
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const tenantId = userData?.tenant_id || undefined;

    // Check if user has Google Sheets integration
    // Try both tables - user_integrations and cloud_storage_connections
    console.log("Checking Google Sheets connection for user:", user.id, "tenant_id:", tenantId || "none");
    
    // Use maybeSingle() to handle cases where no rows exist (returns null instead of error)
    const { data: integration, error: integrationError } = await supabase
      .from("user_integrations")
      .select("access_token, refresh_token, provider_email, provider, token_expires_at")
      .eq("user_id", user.id)
      .eq("provider", "google_sheets")
      .maybeSingle();

    console.log("user_integrations query result:", {
      hasIntegration: !!integration,
      error: integrationError?.message || null,
      providerEmail: integration?.provider_email || null,
    });

    const { data: connection, error: connectionError } = await supabase
      .from("cloud_storage_connections")
      .select("access_token_encrypted, refresh_token_encrypted, provider, token_expires_at, is_active")
      .eq("user_id", user.id)
      .eq("provider", "google_sheets")
      .eq("is_active", true)
      .maybeSingle();

    console.log("cloud_storage_connections query result:", {
      hasConnection: !!connection,
      error: connectionError?.message || null,
      isActive: connection?.is_active || false,
    });

    if (!integration && !connection) {
      console.log("No Google Sheets connection found for user:", user.id);
      return NextResponse.json(
        { 
          error: "Google Sheets is not connected. Please connect your Google account to access your spreadsheets.",
          error_code: "NOT_CONNECTED",
          guidance: "Please go to Settings > Integrations > Google Sheets and click 'Connect Google Account' to authorize access to your Google Sheets."
        },
        { status: 400 }
      );
    }

    let auth;
    let sheets: ReturnType<typeof google.sheets>;

    // Try to use OAuth credentials first (from user's connection)
    try {
      let accessToken: string | null = null;
      let refreshToken: string | null = null;
      let expiresAt: Date | null = null;

      // Get tokens from either table
      try {
        if (integration?.access_token) {
          accessToken = decryptOAuthToken(integration.access_token);
          refreshToken = integration.refresh_token
            ? decryptOAuthToken(integration.refresh_token)
            : null;
          expiresAt = integration.token_expires_at
            ? new Date(integration.token_expires_at)
            : null;
        } else if (connection?.access_token_encrypted) {
          accessToken = decryptOAuthToken(connection.access_token_encrypted);
          refreshToken = connection.refresh_token_encrypted
            ? decryptOAuthToken(connection.refresh_token_encrypted)
            : null;
          expiresAt = connection.token_expires_at
            ? new Date(connection.token_expires_at)
            : null;
        }
      } catch (decryptErr: any) {
        console.error("Failed to decrypt Google OAuth tokens. User must reconnect.", {
          userId: user.id,
          tenantId: tenantId || "none",
          message: decryptErr?.message,
        });

        return NextResponse.json(
          {
            error:
              "We couldn't read your saved Google connection. Please reconnect your Google account.",
            error_code: "TOKEN_DECRYPT_FAILED",
            guidance:
              "Go to Settings > Integrations > Google Sheets and click 'Connect Google Account' to reconnect.",
          },
          { status: 401 }
        );
      }

      if (!accessToken) {
        return NextResponse.json(
          { 
            error: "Failed to retrieve access token. Please reconnect your Google account.",
            error_code: "TOKEN_ERROR",
            guidance: "Your Google Sheets connection may have expired. Please go to Settings > Integrations > Google Sheets and click 'Connect Google Account' to reconnect."
          },
          { status: 500 }
        );
      }

      // Get tenant-specific OAuth credentials (same as used during OAuth flow)
      const credentialManager = getCredentialManager();
      const oauthCreds = await credentialManager.getBestGoogleOAuth(tenantId);
      
      if (!oauthCreds) {
        console.error("OAuth credentials not configured for tenant:", tenantId || "platform-level");
        return NextResponse.json(
          { 
            error: "Google OAuth credentials are not configured. Please contact your administrator.",
            error_code: "CREDENTIALS_NOT_CONFIGURED",
            guidance: "OAuth credentials need to be set up before you can connect Google Sheets. Please contact your system administrator."
          },
          { status: 500 }
        );
      }

      // Derive redirect URI from request origin (same pattern as connect route)
      const computedRedirectUri = new URL(
        "/api/integrations/google-sheets/callback",
        request.nextUrl.origin
      ).toString();

      // Log credential source for debugging
      console.log("Using OAuth credentials for token refresh:", {
        credentialSource: tenantId ? "tenant-specific" : "platform-level",
        tenantId: tenantId || "none",
        redirectUri: computedRedirectUri,
        clientIdPrefix: oauthCreds.clientId ? `${oauthCreds.clientId.substring(0, 20)}...` : "missing",
      });

      // Check if token is expired and refresh if needed
      const oauth2Client = new google.auth.OAuth2(
        oauthCreds.clientId,
        oauthCreds.clientSecret,
        computedRedirectUri
      );

      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken || undefined,
      });

      // Refresh token if expired
      if (expiresAt && expiresAt < new Date()) {
        console.log("Access token expired, attempting refresh. Expires at:", expiresAt.toISOString());
        if (refreshToken) {
          try {
            const { credentials } = await oauth2Client.refreshAccessToken();
            accessToken = credentials.access_token || accessToken;
            console.log("Token refreshed successfully");
            // Update stored token (simplified - in production, update database)
          } catch (refreshError: any) {
            console.error("Token refresh failed:", {
              error: refreshError.message,
              code: refreshError.code,
              tenantId: tenantId || "none",
              credentialSource: tenantId ? "tenant-specific" : "platform-level",
            });
            return NextResponse.json(
              { 
                error: "Your Google Sheets connection has expired and we couldn't refresh it automatically. Please reconnect your Google account.",
                error_code: "TOKEN_EXPIRED",
                guidance: "Please go to Settings > Integrations > Google Sheets and click 'Connect Google Account' to reconnect."
              },
              { status: 401 }
            );
          }
        } else {
          console.warn("Token expired but no refresh token available");
          return NextResponse.json(
            { 
              error: "Your Google Sheets connection has expired. Please reconnect your Google account.",
              error_code: "TOKEN_EXPIRED",
              guidance: "Please go to Settings > Integrations > Google Sheets and click 'Connect Google Account' to reconnect."
            },
            { status: 401 }
          );
        }
      } else {
        console.log("Access token is valid. Expires at:", expiresAt ? expiresAt.toISOString() : "unknown");
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
        connectedAccount: integration?.provider_email || null,
      });
    } catch (error: any) {
      console.error("Error listing Google Sheets:", {
        error: error.message,
        code: error.code,
        tenantId: tenantId || "none",
        credentialSource: tenantId ? "tenant-specific" : "platform-level",
      });
      
      // Provide more specific error messages based on error type
      let errorMessage = error.message || "Failed to list Google Sheets";
      let errorCode = "API_ERROR";
      let guidance = "Please try again or contact support if the issue persists.";

      if (error.code === 401 || error.message?.includes("unauthorized")) {
        errorMessage = "Your Google Sheets connection is no longer valid. Please reconnect your Google account.";
        errorCode = "AUTH_ERROR";
        guidance = "Please go to Settings > Integrations > Google Sheets and click 'Connect Google Account' to reconnect.";
      } else if (error.code === 403 || error.message?.includes("permission")) {
        errorMessage = "You don't have permission to access Google Sheets. Please check your Google account permissions.";
        errorCode = "PERMISSION_ERROR";
        guidance = "Please ensure you've granted the necessary permissions when connecting your Google account.";
      } else if (
        typeof error.message === "string" &&
        (error.message.toLowerCase().includes("bad decrypt") ||
          error.message.toLowerCase().includes("invalid encrypted text format") ||
          error.message.toLowerCase().includes("encryption_key not configured"))
      ) {
        errorMessage =
          "We couldn't read your saved Google connection. Please reconnect your Google account.";
        errorCode = "TOKEN_DECRYPT_FAILED";
        guidance =
          "Go to Settings > Integrations > Google Sheets and click 'Connect Google Account' to reconnect.";
      }

      return NextResponse.json(
        { 
          error: errorMessage,
          error_code: errorCode,
          guidance: guidance
        },
        { status: errorCode === "TOKEN_DECRYPT_FAILED" ? 401 : 500 }
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

