/**
 * Admin API - Get tenant integration settings
 * Platform admins can view any tenant's integration settings
 */

import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import { NextResponse } from "next/server";
import { isPlatformAdmin } from "@/app/actions/organization-admins";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is Platform Admin
    const isAdmin = await isPlatformAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Only Platform Administrators can access this endpoint" },
        { status: 403 }
      );
    }

    // Use admin client to fetch tenant settings
    const adminClient = createAdminClient();

    // Get integration settings for this tenant
    const { data: settings, error: settingsError } = await (adminClient as any)
      .from("tenant_integration_settings")
      .select("*")
      .eq("tenant_id", tenantId);

    if (settingsError) {
      console.error("Error fetching integration settings:", settingsError);
      return NextResponse.json(
        { error: "Failed to fetch settings" },
        { status: 500 }
      );
    }

    // Mask sensitive values in response
    const maskedSettings = (settings || []).map((setting: any) => ({
      ...setting,
      custom_client_secret: setting.custom_client_secret ? "••••••••" : null,
      airtable_api_key: setting.airtable_api_key ? "••••••••" : null,
    }));

    return NextResponse.json({
      tenantId,
      settings: maskedSettings,
    });
  } catch (error) {
    console.error(
      "Error in GET /api/admin/tenant-settings/[tenantId]/integrations:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

