import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { google } from "googleapis";
import { createOAuthSheetsClient } from "@/lib/google-sheets/auth-helpers";
import { getCredentialManager } from "@/lib/credentials/VercelCredentialManager";

/**
 * GET /api/integrations/google-sheets/validate?spreadsheetId=...
 * Validates access to a Google Sheet and returns its metadata
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

    const spreadsheetId = request.nextUrl.searchParams.get("spreadsheetId");
    
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: "spreadsheetId parameter is required", success: false },
        { status: 400 }
      );
    }

    // Extract spreadsheet ID from URL if full URL provided
    let cleanId = spreadsheetId;
    const urlMatch = spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch) {
      cleanId = urlMatch[1];
    }

    // Try user OAuth first, then service account
    let sheets;
    let authMethod = "unknown";

    try {
      const { sheets: oauthSheets } = await createOAuthSheetsClient(user.id);
      sheets = oauthSheets;
      authMethod = "oauth";
    } catch {
      // Fallback to service account
      const credentialManager = getCredentialManager();
      const { data: userData } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const serviceAccountCreds = await credentialManager.getBestGoogleServiceAccount(
        userData?.tenant_id || undefined
      );

      if (!serviceAccountCreds) {
        return NextResponse.json({
          success: false,
          error: "No Google authentication available. Please connect your Google account.",
        }, { status: 400 });
      }

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: serviceAccountCreds.email,
          private_key: serviceAccountCreds.privateKey.replace(/\\n/g, "\n"),
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });

      sheets = google.sheets({ version: "v4", auth });
      authMethod = "service_account";
    }

    // Try to get spreadsheet metadata
    try {
      const response = await sheets.spreadsheets.get({
        spreadsheetId: cleanId,
        fields: "properties.title,sheets.properties.title",
      });

      const title = response.data.properties?.title || "Unknown";
      const sheetTabs = response.data.sheets?.map(s => s.properties?.title) || [];

      return NextResponse.json({
        success: true,
        spreadsheetId: cleanId,
        title,
        sheetTabs,
        authMethod,
        url: `https://docs.google.com/spreadsheets/d/${cleanId}`,
      });

    } catch (sheetError: any) {
      if (sheetError.code === 404) {
        return NextResponse.json({
          success: false,
          error: "Spreadsheet not found. Check the URL or ID is correct.",
        });
      } else if (sheetError.code === 403) {
        return NextResponse.json({
          success: false,
          error: "Access denied. Make sure you have access to this spreadsheet.",
        });
      } else {
        throw sheetError;
      }
    }

  } catch (error: any) {
    console.error("Error validating spreadsheet:", error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Failed to validate spreadsheet",
      },
      { status: 500 }
    );
  }
}

