import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { google } from "googleapis";
import { getCredentialManager } from "@/lib/credentials/VercelCredentialManager";

/**
 * GET /api/integrations/google-sheets/shared-drives/test
 * Tests access to a specific shared drive
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

    const driveId = request.nextUrl.searchParams.get("driveId");
    
    if (!driveId) {
      return NextResponse.json(
        { error: "driveId parameter is required", success: false },
        { status: 400 }
      );
    }

    // Get service account credentials
    const credentialManager = getCredentialManager();
    
    // Get user's tenant_id
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const serviceAccountCreds = await credentialManager.getBestGoogleServiceAccount(
      userData?.tenant_id || undefined
    );

    if (!serviceAccountCreds) {
      return NextResponse.json(
        { 
          error: "Service account not configured",
          success: false,
        },
        { status: 200 }
      );
    }

    // Create Google Drive client with service account
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceAccountCreds.email,
        private_key: serviceAccountCreds.privateKey.replace(/\\n/g, "\n"),
      },
      scopes: [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.file",
      ],
    });

    const drive = google.drive({ version: "v3", auth });

    // Try to get the drive metadata
    try {
      const driveInfo = await drive.drives.get({
        driveId,
        fields: "id,name,createdTime",
      });

      // Try to list files to verify write access
      await drive.files.list({
        driveId,
        corpora: "drive",
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        pageSize: 1,
      });

      return NextResponse.json({
        success: true,
        driveName: driveInfo.data.name,
        driveId: driveInfo.data.id,
        message: "Successfully connected to shared drive",
      });

    } catch (driveError: any) {
      if (driveError.code === 404) {
        return NextResponse.json({
          success: false,
          error: "Shared Drive not found. Check the Drive ID is correct.",
        });
      } else if (driveError.code === 403) {
        return NextResponse.json({
          success: false,
          error: "Access denied. Make sure the service account is added as a Manager to this Shared Drive.",
        });
      } else {
        throw driveError;
      }
    }

  } catch (error: any) {
    console.error("Error testing shared drive access:", error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Failed to test shared drive access",
      },
      { status: 500 }
    );
  }
}

