import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { google } from "googleapis";

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
    const { data: connection } = await supabase
      .from("cloud_storage_connections")
      .select("encrypted_credentials, provider")
      .eq("user_id", user.id)
      .eq("provider", "google_sheets")
      .eq("is_active", true)
      .single();

    if (!connection) {
      return NextResponse.json(
        { 
          error: "Google Sheets not connected",
          error_code: "NOT_CONNECTED"
        },
        { status: 400 }
      );
    }

    // Check if service account credentials are available (for OAuth fallback)
    const hasServiceAccount = 
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && 
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    let auth;
    let sheets;

    // Try to use OAuth credentials first (from user's connection)
    try {
      // Decrypt credentials (you'll need to implement decryption)
      // For now, we'll use service account as fallback
      if (hasServiceAccount) {
        auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
          },
          scopes: [
            "https://www.googleapis.com/auth/spreadsheets.readonly",
            "https://www.googleapis.com/auth/drive.readonly",
          ],
        });
      } else {
        return NextResponse.json(
          { 
            error: "Google Sheets API not configured",
            error_code: "NOT_CONFIGURED"
          },
          { status: 500 }
        );
      }

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

