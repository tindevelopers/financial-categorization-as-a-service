import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import { getCurrentTenant } from "@/core/multi-tenancy/server";
import { getSupabaseCredentialManager } from "@/lib/credentials/SupabaseCredentialManager";
import type { TenantOAuthCredentials } from "@/lib/credentials/SupabaseCredentialManager";

/**
 * GET /api/tenant/credentials/oauth
 * Retrieve tenant OAuth credentials metadata
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get tenant ID from query params or current user's tenant
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get("tenant_id");
    const provider = searchParams.get("provider") || "google";
    const credentialType = (searchParams.get("credential_type") ||
      "individual") as "individual" | "corporate";

    // Use provided tenant_id or get from current user
    const finalTenantId = tenantId || (await getCurrentTenant());

    if (!finalTenantId) {
      return NextResponse.json(
        { error: "Tenant ID required" },
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

    // If specific provider/type requested, get that
    if (provider && credentialType) {
      const metadata = await supabaseManager.getTenantOAuthMetadata(
        finalTenantId,
        provider,
        credentialType
      );

      if (!metadata) {
        return NextResponse.json({
          has_tenant_credentials: false,
          credentials: null,
        });
      }

      return NextResponse.json({
        has_tenant_credentials: true,
        metadata,
      });
    }

    // Otherwise, list all credentials for tenant
    const credentials = await supabaseManager.listTenantOAuthCredentials(
      finalTenantId
    );

    return NextResponse.json({
      tenant_id: finalTenantId,
      credentials,
    });
  } catch (error) {
    console.error("Error retrieving tenant OAuth credentials:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to retrieve credentials",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tenant/credentials/oauth
 * Save tenant OAuth credentials
 * Note: Secrets must be set via `supabase secrets set` CLI before calling this
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
      client_id,
      client_secret,
      redirect_uri,
      service_account_email,
      service_account_private_key,
    } = body;

    // Validate required fields
    if (!tenant_id || !provider || !credential_type || !client_id || !client_secret) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: tenant_id, provider, credential_type, client_id, client_secret",
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

    if (!userData || userData.tenant_id !== tenant_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabaseManager = getSupabaseCredentialManager();

    const credentials: TenantOAuthCredentials = {
      clientId: client_id,
      clientSecret: client_secret,
      redirectUri: redirect_uri,
      serviceAccountEmail: service_account_email,
      serviceAccountPrivateKey: service_account_private_key,
    };

    // Save credentials (this will call Edge Function which validates secrets exist)
    await supabaseManager.saveTenantOAuth(
      tenant_id,
      provider,
      credential_type,
      credentials
    );

    return NextResponse.json({
      success: true,
      message: "Credentials saved successfully",
    });
  } catch (error) {
    console.error("Error saving tenant OAuth credentials:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save credentials",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tenant/credentials/oauth
 * Delete tenant OAuth credentials
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get("tenant_id");
    const provider = searchParams.get("provider") || "google";
    const credentialType = (searchParams.get("credential_type") ||
      "individual") as "individual" | "corporate";

    if (!tenantId || !provider || !credentialType) {
      return NextResponse.json(
        {
          error: "Missing required query parameters: tenant_id, provider, credential_type",
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

    if (!userData || userData.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabaseManager = getSupabaseCredentialManager();
    const deleted = await supabaseManager.deleteTenantOAuth(
      tenantId,
      provider,
      credentialType
    );

    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete credentials" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Credentials deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting tenant OAuth credentials:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete credentials",
      },
      { status: 500 }
    );
  }
}

