import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { google } from "googleapis";
import { createTenantGoogleClientsForRequestUser } from "@/lib/google-sheets/tenant-clients";
import { getTenantGoogleAdminOAuthConnection } from "@/lib/google-sheets/tier-config";

type ProvisionResult = {
  sharedDrive: { id: string; name: string };
  folders: { statementsFolderId: string; invoicesFolderId: string; exportsFolderId: string };
  workspaceDomain: string;
  tier: string;
};

function makeDriveName(companyName: string): string {
  const safe = companyName.trim() || "Company";
  return `FinCat - ${safe}`;
}

async function getLatestCompanyProfileForUser(supabase: any, userId: string) {
  const { data } = await supabase
    .from("company_profiles")
    .select("id, company_name")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data || null;
}

async function ensureFolder(params: {
  drive: ReturnType<typeof google.drive>;
  driveId: string;
  existingFolderId?: string | null;
  folderName: string;
}): Promise<string> {
  const { drive, driveId, existingFolderId, folderName } = params;

  // If we have an ID, validate it still exists.
  if (existingFolderId) {
    try {
      const res = await drive.files.get({
        fileId: existingFolderId,
        supportsAllDrives: true,
        fields: "id,name,mimeType,trashed",
      });
      if (res.data?.id && res.data?.trashed !== true) {
        return res.data.id;
      }
    } catch {
      // Fall through to search/create
    }
  }

  // Search by name within this Shared Drive.
  const search = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and trashed=false`,
    corpora: "drive",
    driveId,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    fields: "files(id,name)",
    pageSize: 10,
  });

  const existing = search.data.files?.[0];
  if (existing?.id) return existing.id;

  // Create folder in Shared Drive root.
  const created = await drive.files.create({
    supportsAllDrives: true,
    fields: "id,name",
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [driveId],
    },
  });

  if (!created.data.id) {
    throw new Error(`Failed to create folder: ${folderName}`);
  }
  return created.data.id;
}

async function ensureDomainWriterPermission(params: {
  drive: ReturnType<typeof google.drive>;
  driveId: string;
  workspaceDomain: string;
}) {
  const { drive, driveId, workspaceDomain } = params;

  // Check if domain already has permission.
  const perms = await drive.permissions.list({
    fileId: driveId,
    supportsAllDrives: true,
    fields: "permissions(id,type,domain,role)",
  });

  const hasDomain = (perms.data.permissions || []).some(
    (p) => p.type === "domain" && p.domain === workspaceDomain && p.role === "writer"
  );
  if (hasDomain) return;

  await drive.permissions.create({
    fileId: driveId,
    supportsAllDrives: true,
    requestBody: {
      type: "domain",
      domain: workspaceDomain,
      role: "writer",
    },
  });
}

/**
 * POST /api/integrations/google-shared-drive/provision
 *
 * Creates (or validates) a tenant Shared Drive and standard folder structure:
 * - Statements/
 * - Invoices/
 * - Exports/
 *
 * Persists results to:
 * - tenant_integration_settings.settings (tenant-level canonical config)
 * - company_profiles.google_shared_drive_id/name (for existing setup wizard fields)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clients = await createTenantGoogleClientsForRequestUser();
    if (!clients?.tenantId) {
      return NextResponse.json(
        { error: "No tenant associated with user. Please complete company setup first." },
        { status: 400 }
      );
    }

    if (clients.tier === "consumer") {
      return NextResponse.json(
        { error: "Shared Drive provisioning is only available for company accounts." },
        { status: 403 }
      );
    }

    // Determine the Shared Drive name from latest company profile.
    const companyProfile = await getLatestCompanyProfileForUser(supabase, user.id);
    const sharedDriveName = makeDriveName(companyProfile?.company_name || "Company");

    const drive = clients.drive;
    const workspaceDomain = clients.workspaceDomain || (clients.dwdSubjectEmail?.split("@")[1] || null);

    if (!workspaceDomain) {
      return NextResponse.json(
        {
          error: "Workspace domain not detected for this tenant connection.",
          guidance:
            "For Business Standard, connect using a Google Workspace account. For Enterprise BYO, set dwdSubjectEmail in tenant settings.",
        },
        { status: 400 }
      );
    }

    // Ensure Shared Drive exists (validate existing if configured).
    let driveId = clients.sharedDriveId || null;
    let driveName: string | null = null;

    if (driveId) {
      try {
        const existing = await drive.drives.get({ driveId, fields: "id,name" });
        driveId = existing.data.id || driveId;
        driveName = existing.data.name || driveName || sharedDriveName;
      } catch {
        driveId = null;
        driveName = null;
      }
    }

    if (!driveId) {
      const created = await drive.drives.create({
        requestId: `fincat-${clients.tenantId}-${Date.now()}`,
        fields: "id,name",
        requestBody: { name: sharedDriveName },
      });

      if (!created.data.id) {
        return NextResponse.json({ error: "Failed to create Shared Drive" }, { status: 500 });
      }
      driveId = created.data.id;
      driveName = created.data.name || sharedDriveName;
    }

    // Ensure the domain has writer permissions on the Shared Drive.
    await ensureDomainWriterPermission({ drive, driveId, workspaceDomain });

    // Ensure folders.
    const statementsFolderId = await ensureFolder({
      drive,
      driveId,
      existingFolderId: clients.sharedDriveFolders?.statementsFolderId || null,
      folderName: "Statements",
    });
    const invoicesFolderId = await ensureFolder({
      drive,
      driveId,
      existingFolderId: clients.sharedDriveFolders?.invoicesFolderId || null,
      folderName: "Invoices",
    });
    const exportsFolderId = await ensureFolder({
      drive,
      driveId,
      existingFolderId: clients.sharedDriveFolders?.exportsFolderId || null,
      folderName: "Exports",
    });

    const result: ProvisionResult = {
      sharedDrive: { id: driveId, name: driveName || sharedDriveName },
      folders: { statementsFolderId, invoicesFolderId, exportsFolderId },
      workspaceDomain,
      tier: clients.tier,
    };

    // Persist to tenant_integration_settings.settings (canonical).
    const mergedSettings: Record<string, any> = {
      googleIntegrationTier: clients.tier,
      copyInvoicesToDrive: true,
      googleSharedDrive: result.sharedDrive,
      googleSharedDriveFolders: result.folders,
    };

    if (clients.authMethod === "oauth_tenant_admin") {
      // Keep a stable pointer to the connection owner.
      const adminConn = await getTenantGoogleAdminOAuthConnection(clients.tenantId);
      mergedSettings.googleAdminUserId = adminConn?.userId || null;
    }

    await (supabase as any)
      .from("tenant_integration_settings")
      .upsert(
        {
          tenant_id: clients.tenantId,
          provider: "google_sheets",
          use_custom_credentials: clients.tier === "enterprise_byo",
          is_enabled: true,
          settings: mergedSettings,
          default_sharing_permission: "writer",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,provider" }
      );

    // Also persist drive ID/name to the current user's company profile (setup wizard compatibility).
    if (companyProfile?.id) {
      await supabase
        .from("company_profiles")
        .update({
          google_shared_drive_id: driveId,
          google_shared_drive_name: driveName || sharedDriveName,
        })
        .eq("id", companyProfile.id)
        .eq("user_id", user.id);
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Shared Drive provision error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to provision Shared Drive" },
      { status: 500 }
    );
  }
}


