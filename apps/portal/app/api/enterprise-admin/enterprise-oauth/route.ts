/**
 * Enterprise OAuth (BYO) management API (Portal)
 *
 * This endpoint is intentionally scoped to the CURRENT tenant only.
 * It is meant for Enterprise tenant admins to configure their own BYO OAuth and DWD settings.
 *
 * Security properties:
 * - Does NOT allow selecting arbitrary tenant_id from the request.
 * - Requires: tenant.subscription_type = 'enterprise' AND role in allowedEnterpriseRoles.
 */

import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";
import { NextResponse } from "next/server";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-32-char-key-for-dev-only";

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

const allowedEnterpriseRoles = ["Organization Admin", "Enterprise Admin"] as const;

async function getEnterpriseAdminTenantId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const adminClient = createAdminClient();

  const { data: userRow } = await adminClient
    .from("users")
    .select(
      `
      id,
      tenant_id,
      roles:role_id(name),
      tenants:tenant_id(subscription_type)
    `
    )
    .eq("id", user.id)
    .single();

  const tenantId = (userRow as any)?.tenant_id as string | null;
  const roleName = ((userRow as any)?.roles?.name as string | null) || null;
  const subscriptionType = ((userRow as any)?.tenants?.subscription_type as string | null) || null;

  if (!tenantId) return null;
  if (subscriptionType !== "enterprise") return null;
  if (!allowedEnterpriseRoles.includes(roleName as any)) return null;

  return tenantId;
}

export async function GET() {
  try {
    const tenantId = await getEnterpriseAdminTenantId();
    if (!tenantId) {
      return NextResponse.json(
        { error: "Unauthorized. Enterprise tenant admin access required." },
        { status: 403 }
      );
    }

    const adminClient = createAdminClient();

    const { data: tenant, error: tenantError } = await adminClient
      .from("tenants")
      .select("id, name, domain, subscription_type")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { data: config } = await adminClient
      .from("tenant_integration_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("provider", "google_sheets")
      .maybeSingle();

    const enrichedConfig = config
      ? [
          {
            id: config.id,
            tenant_id: config.tenant_id,
            tenant_name: tenant.name,
            tenant_domain: (tenant as any).domain || null,
            provider: config.provider,
            custom_client_id: config.custom_client_id,
            has_client_secret: !!(config.custom_client_secret || (config as any).client_secret_vault_id),
            custom_redirect_uri: config.custom_redirect_uri,
            use_custom_credentials: config.use_custom_credentials,
            is_enabled: config.is_enabled,
            dwd_subject_email: (config as any).settings?.dwdSubjectEmail || null,
            updated_at: config.updated_at,
          },
        ]
      : [];

    return NextResponse.json({
      tenants: [tenant],
      configs: enrichedConfig,
    });
  } catch (error) {
    console.error("Error in GET /api/enterprise-admin/enterprise-oauth:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const tenantId = await getEnterpriseAdminTenantId();
    if (!tenantId) {
      return NextResponse.json(
        { error: "Unauthorized. Enterprise tenant admin access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      provider,
      custom_client_id,
      custom_client_secret,
      custom_redirect_uri,
      dwd_subject_email,
      use_custom_credentials,
      is_enabled,
    } = body;

    if (provider !== "google_sheets") {
      return NextResponse.json({ error: "provider must be google_sheets" }, { status: 400 });
    }

    if (!custom_client_id) {
      return NextResponse.json({ error: "custom_client_id is required" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: existingConfig } = await adminClient
      .from("tenant_integration_settings")
      .select("settings")
      .eq("tenant_id", tenantId)
      .eq("provider", "google_sheets")
      .maybeSingle();

    const settingsData: any = {
      tenant_id: tenantId,
      provider: "google_sheets",
      custom_client_id: custom_client_id || null,
      custom_redirect_uri: custom_redirect_uri || null,
      use_custom_credentials: use_custom_credentials ?? true,
      is_enabled: is_enabled ?? true,
      updated_at: new Date().toISOString(),
    };

    const existingSettings = (existingConfig as any)?.settings || {};
    settingsData.settings = {
      ...existingSettings,
      dwdSubjectEmail: dwd_subject_email || null,
      googleIntegrationTier: "enterprise_byo",
    };

    if (custom_client_secret && custom_client_secret !== "••••••••") {
      settingsData.custom_client_secret = encrypt(custom_client_secret);
    }

    const { data: result, error: upsertError } = await adminClient
      .from("tenant_integration_settings")
      .upsert(settingsData, { onConflict: "tenant_id,provider" })
      .select()
      .single();

    if (upsertError || !result) {
      console.error("Error saving enterprise OAuth config:", upsertError);
      return NextResponse.json({ error: "Failed to save configuration" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      config: {
        ...result,
        custom_client_secret: undefined,
        has_client_secret: !!(result as any).custom_client_secret,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/enterprise-admin/enterprise-oauth:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const tenantId = await getEnterpriseAdminTenantId();
    if (!tenantId) {
      return NextResponse.json(
        { error: "Unauthorized. Enterprise tenant admin access required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");
    if (provider !== "google_sheets") {
      return NextResponse.json({ error: "provider must be google_sheets" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error: deleteError } = await adminClient
      .from("tenant_integration_settings")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("provider", "google_sheets");

    if (deleteError) {
      console.error("Error deleting enterprise OAuth config:", deleteError);
      return NextResponse.json({ error: "Failed to delete configuration" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/enterprise-admin/enterprise-oauth:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


