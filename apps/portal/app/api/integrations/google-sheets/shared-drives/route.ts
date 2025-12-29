import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { google } from "googleapis";
import { getCredentialManager } from "@/lib/credentials/VercelCredentialManager";

/**
 * GET /api/integrations/google-sheets/shared-drives
 * Lists shared drives accessible to the service account
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
          drives: [],
          guidance: "Please configure Google service account credentials in your environment."
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

    // List shared drives the service account has access to
    const response = await drive.drives.list({
      pageSize: 100,
      fields: "drives(id,name,createdTime)",
    });

    const drives = response.data.drives?.map(d => ({
      id: d.id,
      name: d.name,
      createdTime: d.createdTime,
    })) || [];

    return NextResponse.json({
      success: true,
      drives,
      serviceAccountEmail: serviceAccountCreds.email,
    });

  } catch (error: any) {
    console.error("Error listing shared drives:", error);
    
    return NextResponse.json(
      { 
        error: error.message || "Failed to list shared drives",
        drives: [],
      },
      { status: 500 }
    );
  }
}

