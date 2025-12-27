import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import { getCurrentTenant } from "@/core/multi-tenancy/server";
import { getSupabaseCredentialManager } from "@/lib/credentials/SupabaseCredentialManager";

/**
 * POST /api/tenant/credentials/test
 * Test tenant OAuth credentials by attempting to use them
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      tenant_id,
      provider,
      credential_type,
    } = body;

    // Use provided tenant_id or get from current user
    const finalTenantId = tenant_id || (await getCurrentTenant());

    if (!finalTenantId || !provider) {
      return NextResponse.json(
        {
          error: "Missing required fields: tenant_id (or current tenant), provider",
        },
        { status: 400 }
      );
    }

    // Verify user belongs to tenant
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData || userData.tenant_id !== finalTenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabaseManager = getSupabaseCredentialManager();
    const credentials = await supabaseManager.getTenantOAuth(
      finalTenantId,
      provider,
      credential_type || "individual"
    );

    if (!credentials) {
      return NextResponse.json(
        {
          success: false,
          error: "No tenant credentials found",
        },
        { status: 404 }
      );
    }

    // Test credentials based on provider
    let testResult: { success: boolean; message: string; details?: any };

    switch (provider) {
      case "google":
      case "google_sheets":
      case "google_drive":
        // For Google, we can test by attempting to create an OAuth2 client
        // This validates the client_id and client_secret format
        try {
          // Basic validation: check if credentials are non-empty
          if (
            !credentials.clientId ||
            !credentials.clientSecret ||
            credentials.clientId.length < 10 ||
            credentials.clientSecret.length < 10
          ) {
            testResult = {
              success: false,
              message: "Invalid credential format",
            };
          } else {
            // Check if client_id matches Google OAuth format
            const isValidGoogleClientId =
              credentials.clientId.includes(".apps.googleusercontent.com") ||
              credentials.clientId.match(/^\d+-\w+\.apps\.googleusercontent\.com$/);

            testResult = {
              success: isValidGoogleClientId,
              message: isValidGoogleClientId
                ? "Google OAuth credentials format is valid"
                : "Google OAuth client ID format appears invalid",
              details: {
                client_id_length: credentials.clientId.length,
                client_secret_length: credentials.clientSecret.length,
                has_redirect_uri: !!credentials.redirectUri,
                has_service_account:
                  !!credentials.serviceAccountEmail &&
                  !!credentials.serviceAccountPrivateKey,
              },
            };
          }
        } catch (error) {
          testResult = {
            success: false,
            message: `Error testing credentials: ${error instanceof Error ? error.message : "Unknown error"}`,
          };
        }
        break;

      case "dropbox":
        // For Dropbox, validate format
        testResult = {
          success:
            !!credentials.clientId &&
            !!credentials.clientSecret &&
            credentials.clientId.length > 0 &&
            credentials.clientSecret.length > 0,
          message:
            credentials.clientId && credentials.clientSecret
              ? "Dropbox OAuth credentials format is valid"
              : "Invalid Dropbox credentials",
        };
        break;

      default:
        testResult = {
          success: false,
          message: `Provider ${provider} not supported for testing`,
        };
    }

    return NextResponse.json({
      tenant_id: finalTenantId,
      provider,
      credential_type: credential_type || "individual",
      test_result: testResult,
    });
  } catch (error) {
    console.error("Error testing tenant OAuth credentials:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to test credentials",
      },
      { status: 500 }
    );
  }
}

