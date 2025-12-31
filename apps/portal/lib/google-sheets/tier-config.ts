import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";
import { getEntityInfo } from "@/lib/entity-type";
import type { OAuthTokens } from "@/lib/google-sheets/auth-helpers";
import { decryptToken } from "@/lib/google-sheets/auth-helpers";

export type GoogleIntegrationTier = "consumer" | "business_standard" | "enterprise_byo";

export interface TenantGoogleIntegrationConfig {
  tenantId: string;
  entityType: "individual" | "company";
  tier: GoogleIntegrationTier;
  // For Business Standard / Enterprise: company-wide Shared Drive destination
  sharedDriveId?: string | null;
  sharedDriveName?: string | null;
  statementsFolderId?: string | null;
  invoicesFolderId?: string | null;
  exportsFolderId?: string | null;
  // Policy/config
  defaultSharingPermission?: "reader" | "writer";
  copyInvoicesToDrive?: boolean;
  // Enterprise BYO DWD subject (impersonation identity)
  dwdSubjectEmail?: string | null;
  // Business Standard admin connection holder (a portal user id)
  adminConnectionUserId?: string | null;
}

type TenantIntegrationRow = {
  tenant_id: string;
  provider: string;
  use_custom_credentials: boolean | null;
  default_sharing_permission: "reader" | "writer" | null;
  settings: Record<string, any> | null;
};

/**
 * Returns the effective Google integration tier for the current request user + tenant,
 * and pulls Shared Drive + folder config from tenant_integration_settings.settings.
 *
 * Defaults:
 * - entityType=individual => consumer
 * - entityType=company + use_custom_credentials=true => enterprise_byo
 * - entityType=company + use_custom_credentials=false => business_standard
 */
export async function getTenantGoogleIntegrationConfig(): Promise<TenantGoogleIntegrationConfig | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const entityInfo = await getEntityInfo();

  if (!entityInfo.tenantId) return null;

  // IMPORTANT: entity type should be tenant-driven for multi-user tenants.
  // company_profiles is per-user; other users in the same tenant may not have a profile row.
  let entityType: "individual" | "company" = entityInfo.type;
  try {
    const { data: userRow } = await supabase
      .from("users")
      .select("tenant_id, tenants:tenant_id(tenant_type)")
      .eq("id", user.id)
      .maybeSingle();

    const tenantType = (userRow as any)?.tenants?.tenant_type || null;
    if (tenantType === "company") entityType = "company";
    if (tenantType === "individual") entityType = "individual";
  } catch {
    // Fall back to profile-based entityInfo.type
  }

  const { data: setting } = await (supabase as any)
    .from("tenant_integration_settings")
    .select("tenant_id, provider, use_custom_credentials, default_sharing_permission, settings")
    .eq("tenant_id", entityInfo.tenantId)
    .eq("provider", "google_sheets")
    .maybeSingle();

  const row: TenantIntegrationRow | null = setting || null;
  const settings = (row?.settings || {}) as Record<string, any>;

  const explicitTier = (settings.googleIntegrationTier as GoogleIntegrationTier | undefined) || undefined;

  let tier: GoogleIntegrationTier;
  // CRITICAL: Individual accounts CANNOT use enterprise_byo tier, even if explicitly set
  // This prevents individual accounts from requiring BYO credentials
  if (entityType === "individual") {
    tier = "consumer";
  } else if (explicitTier) {
    // Only allow explicit tier override for company/enterprise accounts
    tier = explicitTier;
  } else if (row?.use_custom_credentials) {
    tier = "enterprise_byo";
  } else {
    tier = "business_standard";
  }

  const sharedDrive = settings.googleSharedDrive || {};
  const folders = settings.googleSharedDriveFolders || {};

  return {
    tenantId: entityInfo.tenantId,
    entityType,
    tier,
    sharedDriveId: sharedDrive.id ?? null,
    sharedDriveName: sharedDrive.name ?? null,
    statementsFolderId: folders.statementsFolderId ?? null,
    invoicesFolderId: folders.invoicesFolderId ?? null,
    exportsFolderId: folders.exportsFolderId ?? null,
    defaultSharingPermission: row?.default_sharing_permission ?? undefined,
    copyInvoicesToDrive: settings.copyInvoicesToDrive ?? undefined,
    dwdSubjectEmail: settings.dwdSubjectEmail ?? null,
    adminConnectionUserId: settings.googleAdminUserId ?? null,
  };
}

export interface TenantGoogleAdminOAuthConnection {
  userId: string;
  tenantId: string;
  providerEmail: string | null;
  workspaceDomain: string | null;
  tokens: OAuthTokens;
}

/**
 * Business Standard relies on a single "company admin" OAuth connection that the backend
 * can use on behalf of the tenant. Since `cloud_storage_connections` is RLS'ed per user,
 * we fetch it via the admin client.
 */
export async function getTenantGoogleAdminOAuthConnection(
  tenantId: string
): Promise<TenantGoogleAdminOAuthConnection | null> {
  const adminClient = createAdminClient();

  const { data: conn } = await adminClient
    .from("cloud_storage_connections")
    .select("user_id, tenant_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, is_active, is_workspace_admin, workspace_domain")
    .eq("tenant_id", tenantId)
    .eq("provider", "google_sheets")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(5);

  const candidates = (conn || []) as any[];
  const best = candidates.find((c) => c.is_workspace_admin) || candidates[0];
  if (!best?.access_token_encrypted) return null;

  // provider_email is stored in user_integrations, not cloud_storage_connections
  const { data: ui } = await adminClient
    .from("user_integrations")
    .select("provider_email")
    .eq("user_id", best.user_id)
    .eq("provider", "google_sheets")
    .maybeSingle();

  const tokens: OAuthTokens = {
    accessToken: decryptToken(best.access_token_encrypted),
    refreshToken: best.refresh_token_encrypted ? decryptToken(best.refresh_token_encrypted) : null,
    expiresAt: best.token_expires_at ? new Date(best.token_expires_at) : null,
  };

  return {
    userId: best.user_id,
    tenantId: best.tenant_id,
    providerEmail: ui?.provider_email || null,
    workspaceDomain: best.workspace_domain || null,
    tokens,
  };
}


