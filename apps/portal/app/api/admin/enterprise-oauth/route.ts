/**
 * Enterprise OAuth Credentials Management API (Portal)
 * 
 * Platform Admin-only endpoints for managing OAuth credentials for Enterprise tenants.
 * This is a copy of the admin app's endpoint, accessible from the portal for convenience.
 * 
 * GET - List all enterprise tenants and their OAuth configurations
 * POST - Save/update OAuth credentials for an enterprise tenant
 * DELETE - Remove OAuth credentials for an enterprise tenant
 */

import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";
import { NextResponse } from "next/server";
import crypto from "crypto";

// Encryption helpers
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-32-char-key-for-dev-only";

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

// Check if user is a Platform Admin
async function isPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return false;
  }
  
  const adminClient = createAdminClient();
  
  // Check if user has Platform Admin role
  const { data: userData, error: userError } = await adminClient
    .from("users")
    .select(`
      id,
      role_id,
      tenant_id,
      roles:role_id (
        id,
        name
      )
    `)
    .eq("id", user.id)
    .single();
  
  if (userError || !userData) {
    return false;
  }
  
  const roleName = (userData.roles as any)?.name;
  // Platform Admin has no tenant_id and has Platform Admin role
  return roleName === "Platform Admin" && !userData.tenant_id;
}

/**
 * GET - List all enterprise tenants and their OAuth configurations
 */
export async function GET() {
  try {
    // Verify Platform Admin access
    const isAdmin = await isPlatformAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized. Platform Admin access required." },
        { status: 403 }
      );
    }
    
    const adminClient = createAdminClient();
    
    // Get all enterprise tenants
    const { data: tenants, error: tenantsError } = await adminClient
      .from("tenants")
      .select("id, name, domain, subscription_type")
      .eq("subscription_type", "enterprise")
      .order("name");
    
    if (tenantsError) {
      console.error("Error fetching tenants:", tenantsError);
      return NextResponse.json(
        { error: "Failed to fetch tenants" },
        { status: 500 }
      );
    }
    
    // Get OAuth configurations for these tenants
    const tenantIds = tenants?.map(t => t.id) || [];
    
    let configs: any[] = [];
    if (tenantIds.length > 0) {
      const { data: configData, error: configError } = await adminClient
        .from("tenant_integration_settings")
        .select("*")
        .in("tenant_id", tenantIds)
        .eq("provider", "google_sheets");
      
      if (configError) {
        console.error("Error fetching OAuth configs:", configError);
      } else {
        configs = configData || [];
      }
    }
    
    // Merge tenant info with config info
    const enrichedConfigs = configs.map(config => {
      const tenant = tenants?.find(t => t.id === config.tenant_id);
      return {
        id: config.id,
        tenant_id: config.tenant_id,
        tenant_name: tenant?.name || "Unknown",
        tenant_domain: tenant?.domain,
        provider: config.provider,
        custom_client_id: config.custom_client_id,
        has_client_secret: !!(config.custom_client_secret || config.client_secret_vault_id),
        custom_redirect_uri: config.custom_redirect_uri,
        use_custom_credentials: config.use_custom_credentials,
        is_enabled: config.is_enabled,
        dwd_subject_email: config.settings?.dwdSubjectEmail || null,
        updated_at: config.updated_at,
      };
    });
    
    return NextResponse.json({
      tenants: tenants || [],
      configs: enrichedConfigs,
    });
    
  } catch (error) {
    console.error("Error in GET /api/admin/enterprise-oauth:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST - Save/update OAuth credentials for an enterprise tenant
 */
export async function POST(request: Request) {
  try {
    // Verify Platform Admin access
    const isAdmin = await isPlatformAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized. Platform Admin access required." },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const {
      tenant_id,
      provider,
      custom_client_id,
      custom_client_secret,
      custom_redirect_uri,
      dwd_subject_email,
      use_custom_credentials,
      is_enabled,
    } = body;
    
    if (!tenant_id) {
      return NextResponse.json(
        { error: "tenant_id is required" },
        { status: 400 }
      );
    }
    
    if (!provider) {
      return NextResponse.json(
        { error: "provider is required" },
        { status: 400 }
      );
    }
    
    const adminClient = createAdminClient();
    
    // Verify tenant exists and is enterprise
    const { data: tenant, error: tenantError } = await adminClient
      .from("tenants")
      .select("id, subscription_type")
      .eq("id", tenant_id)
      .single();
    
    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }
    
    if (tenant.subscription_type !== "enterprise") {
      return NextResponse.json(
        { error: "Only enterprise tenants can have custom OAuth credentials" },
        { status: 400 }
      );
    }
    
    // Get existing settings to merge
    const { data: existingConfig } = await adminClient
      .from("tenant_integration_settings")
      .select("settings")
      .eq("tenant_id", tenant_id)
      .eq("provider", provider)
      .single();
    
    // Prepare settings data
    const settingsData: any = {
      tenant_id,
      provider,
      custom_client_id: custom_client_id || null,
      custom_redirect_uri: custom_redirect_uri || null,
      use_custom_credentials: use_custom_credentials ?? true,
      is_enabled: is_enabled ?? true,
      updated_at: new Date().toISOString(),
    };
    
    // Handle DWD subject email in settings JSONB - merge with existing
    const existingSettings = existingConfig?.settings || {};
    settingsData.settings = {
      ...existingSettings,
      dwdSubjectEmail: dwd_subject_email || null,
      googleIntegrationTier: "enterprise_byo",
    };
    
    // Handle client secret encryption
    if (custom_client_secret && custom_client_secret !== "••••••••") {
      settingsData.custom_client_secret = encrypt(custom_client_secret);
    }
    
    // Upsert the configuration
    const { data: result, error: upsertError } = await adminClient
      .from("tenant_integration_settings")
      .upsert(settingsData, {
        onConflict: "tenant_id,provider",
      })
      .select()
      .single();
    
    if (upsertError) {
      console.error("Error saving OAuth config:", upsertError);
      return NextResponse.json(
        { error: "Failed to save configuration" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      config: {
        ...result,
        custom_client_secret: undefined, // Don't return the encrypted secret
        has_client_secret: !!result.custom_client_secret,
      },
    });
    
  } catch (error) {
    console.error("Error in POST /api/admin/enterprise-oauth:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove OAuth credentials for an enterprise tenant
 */
export async function DELETE(request: Request) {
  try {
    // Verify Platform Admin access
    const isAdmin = await isPlatformAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized. Platform Admin access required." },
        { status: 403 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const tenant_id = searchParams.get("tenant_id");
    const provider = searchParams.get("provider");
    
    if (!tenant_id || !provider) {
      return NextResponse.json(
        { error: "tenant_id and provider are required" },
        { status: 400 }
      );
    }
    
    const adminClient = createAdminClient();
    
    // Delete the configuration
    const { error: deleteError } = await adminClient
      .from("tenant_integration_settings")
      .delete()
      .eq("tenant_id", tenant_id)
      .eq("provider", provider);
    
    if (deleteError) {
      console.error("Error deleting OAuth config:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete configuration" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Error in DELETE /api/admin/enterprise-oauth:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

