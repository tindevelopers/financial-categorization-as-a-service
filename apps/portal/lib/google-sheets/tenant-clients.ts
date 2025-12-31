import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";
import { google } from "googleapis";
import { getCredentialManager } from "@/lib/credentials/VercelCredentialManager";
import { getTenantGoogleIntegrationConfig, getTenantGoogleAdminOAuthConnection } from "@/lib/google-sheets/tier-config";
import { decryptToken, encryptToken, getUserOAuthTokens, refreshOAuthToken } from "@/lib/google-sheets/auth-helpers";

export type TenantGoogleAuthMethod = "oauth_user" | "oauth_tenant_admin" | "dwd_service_account";

export interface TenantGoogleClients {
  tenantId: string;
  tier: "consumer" | "business_standard" | "enterprise_byo";
  authMethod: TenantGoogleAuthMethod;
  auth: any;
  drive: ReturnType<typeof google.drive>;
  sheets: ReturnType<typeof google.sheets>;
  workspaceDomain?: string | null;
  dwdSubjectEmail?: string | null;
  sharedDriveId?: string | null;
  sharedDriveFolders?: {
    statementsFolderId?: string | null;
    invoicesFolderId?: string | null;
    exportsFolderId?: string | null;
  };
}

async function persistOAuthTokensAsUser(params: {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}) {
  const supabase = await createClient();
  const encryptedAccess = encryptToken(params.accessToken);
  const encryptedRefresh = params.refreshToken ? encryptToken(params.refreshToken) : null;

  await supabase
    .from("cloud_storage_connections")
    .update({
      access_token_encrypted: encryptedAccess,
      refresh_token_encrypted: encryptedRefresh,
      token_expires_at: params.expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId)
    .eq("provider", "google_sheets");

  await supabase
    .from("user_integrations")
    .update({
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      token_expires_at: params.expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId)
    .eq("provider", "google_sheets");
}

async function persistOAuthTokensAsAdmin(params: {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}) {
  const adminClient = createAdminClient();
  const encryptedAccess = encryptToken(params.accessToken);
  const encryptedRefresh = params.refreshToken ? encryptToken(params.refreshToken) : null;

  await adminClient
    .from("cloud_storage_connections")
    .update({
      access_token_encrypted: encryptedAccess,
      refresh_token_encrypted: encryptedRefresh,
      token_expires_at: params.expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId)
    .eq("provider", "google_sheets");

  await adminClient
    .from("user_integrations")
    .update({
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      token_expires_at: params.expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId)
    .eq("provider", "google_sheets");
}

async function createOAuthClients(params: {
  userId: string;
  tenantId?: string;
  tokens: { accessToken: string; refreshToken: string | null; expiresAt: Date | null };
  persistAs: "user" | "admin";
}) {
  const credentialManager = getCredentialManager();
  const oauthCreds = await credentialManager.getBestGoogleOAuth(params.tenantId);
  if (!oauthCreds) {
    throw new Error("Google OAuth credentials not configured");
  }

  let tokens = params.tokens;

  // Refresh if expired and we have a refresh token
  if (tokens.expiresAt && tokens.expiresAt < new Date() && tokens.refreshToken) {
    tokens = await refreshOAuthToken(tokens.accessToken, tokens.refreshToken, params.tenantId);
    if (params.persistAs === "user") {
      await persistOAuthTokensAsUser({
        userId: params.userId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      });
    } else {
      await persistOAuthTokensAsAdmin({
        userId: params.userId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      });
    }
  }

  const oauth2Client = new google.auth.OAuth2(
    oauthCreds.clientId,
    oauthCreds.clientSecret,
    oauthCreds.redirectUri
  );
  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken || undefined,
  });

  return {
    auth: oauth2Client,
    drive: google.drive({ version: "v3", auth: oauth2Client }),
    sheets: google.sheets({ version: "v4", auth: oauth2Client }),
  };
}

async function createDwdClients(params: { tenantId: string; subjectEmail: string }) {
  const credentialManager = getCredentialManager();
  const sa = await credentialManager.getBestGoogleServiceAccount(params.tenantId);
  if (!sa) {
    throw new Error("Google service account credentials not configured for this tenant");
  }

  const jwt = new google.auth.JWT({
    email: sa.email,
    key: sa.privateKey.replace(/\\n/g, "\n"),
    subject: params.subjectEmail,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });

  await jwt.authorize();

  return {
    auth: jwt,
    drive: google.drive({ version: "v3", auth: jwt }),
    sheets: google.sheets({ version: "v4", auth: jwt }),
  };
}

/**
 * Create Drive + Sheets clients for the current request user, honoring tenant tier selection:
 * - consumer: user OAuth
 * - business_standard: tenant admin OAuth (shared drive)
 * - enterprise_byo: tenant service account with DWD (shared drive)
 */
export async function createTenantGoogleClientsForRequestUser(): Promise<TenantGoogleClients> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Unauthorized");
  }

  const cfg = await getTenantGoogleIntegrationConfig();
  if (!cfg?.tenantId) {
    throw new Error("No tenant associated with user");
  }

  if (cfg.tier === "enterprise_byo") {
    if (!cfg.dwdSubjectEmail) {
      // Fall back to user OAuth if enterprise_byo is configured but dwdSubjectEmail is missing
      console.warn("Enterprise BYO tier detected but dwdSubjectEmail not set, falling back to user OAuth");
      const tokens = await getUserOAuthTokens(user.id);
      if (!tokens) {
        throw new Error("No Google Sheets connection found. Please connect your Google account in Settings > Integrations > Google Sheets.");
      }

      const { auth, drive, sheets } = await createOAuthClients({
        userId: user.id,
        tenantId: cfg.tenantId,
        tokens,
        persistAs: "user",
      });

      return {
        tenantId: cfg.tenantId,
        tier: "consumer", // Downgrade to consumer tier since we're using user OAuth
        authMethod: "oauth_user",
        auth,
        drive,
        sheets,
      };
    }
    const { auth, drive, sheets } = await createDwdClients({ tenantId: cfg.tenantId, subjectEmail: cfg.dwdSubjectEmail });
    return {
      tenantId: cfg.tenantId,
      tier: cfg.tier,
      authMethod: "dwd_service_account",
      auth,
      drive,
      sheets,
      dwdSubjectEmail: cfg.dwdSubjectEmail,
      workspaceDomain: cfg.dwdSubjectEmail.split("@")[1] || null,
      sharedDriveId: cfg.sharedDriveId || null,
      sharedDriveFolders: {
        statementsFolderId: cfg.statementsFolderId || null,
        invoicesFolderId: cfg.invoicesFolderId || null,
        exportsFolderId: cfg.exportsFolderId || null,
      },
    };
  }

  if (cfg.tier === "business_standard") {
    const adminConn = await getTenantGoogleAdminOAuthConnection(cfg.tenantId);
    if (!adminConn) {
      // Fall back to user OAuth if business_standard is configured but admin connection is missing
      console.warn("Business Standard tier detected but no admin OAuth connection found, falling back to user OAuth");
      const tokens = await getUserOAuthTokens(user.id);
      if (!tokens) {
        throw new Error("No Google Sheets connection found. Please connect your Google account in Settings > Integrations > Google Sheets.");
      }

      const { auth, drive, sheets } = await createOAuthClients({
        userId: user.id,
        tenantId: cfg.tenantId,
        tokens,
        persistAs: "user",
      });

      return {
        tenantId: cfg.tenantId,
        tier: "consumer", // Downgrade to consumer tier since we're using user OAuth
        authMethod: "oauth_user",
        auth,
        drive,
        sheets,
      };
    }

    const { auth, drive, sheets } = await createOAuthClients({
      userId: adminConn.userId,
      tenantId: cfg.tenantId,
      tokens: adminConn.tokens,
      persistAs: "admin",
    });

    return {
      tenantId: cfg.tenantId,
      tier: cfg.tier,
      authMethod: "oauth_tenant_admin",
      auth,
      drive,
      sheets,
      workspaceDomain: adminConn.workspaceDomain,
      sharedDriveId: cfg.sharedDriveId || null,
      sharedDriveFolders: {
        statementsFolderId: cfg.statementsFolderId || null,
        invoicesFolderId: cfg.invoicesFolderId || null,
        exportsFolderId: cfg.exportsFolderId || null,
      },
    };
  }

  // consumer: user OAuth
  const tokens = await getUserOAuthTokens(user.id);
  if (!tokens) {
    throw new Error("No Google Sheets connection found. Please connect your Google account.");
  }

  const { auth, drive, sheets } = await createOAuthClients({
    userId: user.id,
    tenantId: cfg.tenantId,
    tokens,
    persistAs: "user",
  });

  return {
    tenantId: cfg.tenantId,
    tier: cfg.tier,
    authMethod: "oauth_user",
    auth,
    drive,
    sheets,
  };
}


