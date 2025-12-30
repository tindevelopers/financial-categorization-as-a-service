import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import { getUserPermissions } from "@/core/permissions/permissions";
import { encrypt, safeDecrypt, maskSensitiveValue } from "@/lib/encryption";

type PlatformSettingRow = {
  setting_key: string;
  setting_value: any;
  updated_at: string;
};

const KEY_GOOGLE_OAUTH = "google_oauth_credentials";
const KEY_GOOGLE_SERVICE_ACCOUNT = "google_service_account_credentials";

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function isMaskedSecret(v: unknown): boolean {
  return typeof v === "string" && v.trim() === "••••••••";
}

/**
 * Platform Google Credentials API (Admin-only)
 *
 * Stores credentials in `platform_settings` as encrypted fields:
 * - google_oauth_credentials: { clientId, redirectUri, clientSecretEncrypted }
 * - google_service_account_credentials: { email, privateKeyEncrypted }
 *
 * NOTE: `platform_settings` is readable by authenticated users (RLS), so secrets must
 * never be stored in plaintext. We store encrypted strings only.
 */

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const permissions = await getUserPermissions(user.id);
  if (!permissions.isPlatformAdmin) {
    return NextResponse.json({ error: "Forbidden: Platform admin access required" }, { status: 403 });
  }

  const adminClient = createAdminClient();
  const { data, error } = await (adminClient as any)
    .from("platform_settings")
    .select("setting_key, setting_value, updated_at")
    .in("setting_key", [KEY_GOOGLE_OAUTH, KEY_GOOGLE_SERVICE_ACCOUNT]) as { data: PlatformSettingRow[] | null; error: any };

  if (error) {
    return NextResponse.json({ error: "Failed to load platform Google credentials" }, { status: 500 });
  }

  const oauthRow = (data || []).find((r) => r.setting_key === KEY_GOOGLE_OAUTH);
  const saRow = (data || []).find((r) => r.setting_key === KEY_GOOGLE_SERVICE_ACCOUNT);

  const oauth = oauthRow?.setting_value || {};
  const sa = saRow?.setting_value || {};

  const oauthClientId = asString(oauth.clientId) || "";
  const oauthRedirectUri = asString(oauth.redirectUri) || "";
  const oauthSecretEncrypted = asString(oauth.clientSecretEncrypted) || "";
  const oauthSecretDecrypted = oauthSecretEncrypted ? safeDecrypt(oauthSecretEncrypted) : "";

  const saEmail = asString(sa.email) || "";
  const saPrivateKeyEncrypted = asString(sa.privateKeyEncrypted) || "";
  const saPrivateKeyDecrypted = saPrivateKeyEncrypted ? safeDecrypt(saPrivateKeyEncrypted) : "";

  return NextResponse.json({
    success: true,
    oauth: {
      clientId: oauthClientId,
      redirectUri: oauthRedirectUri,
      hasClientSecret: !!oauthSecretEncrypted,
      clientSecretMasked: oauthSecretDecrypted ? maskSensitiveValue(oauthSecretDecrypted) : "",
      updatedAt: oauthRow?.updated_at || null,
    },
    serviceAccount: {
      email: saEmail,
      hasPrivateKey: !!saPrivateKeyEncrypted,
      privateKeyMasked: saPrivateKeyDecrypted ? maskSensitiveValue(saPrivateKeyDecrypted) : "",
      updatedAt: saRow?.updated_at || null,
    },
    summary: {
      oauthConfigured: !!(oauthClientId && oauthSecretEncrypted),
      serviceAccountConfigured: !!(saEmail && saPrivateKeyEncrypted),
    },
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const permissions = await getUserPermissions(user.id);
  if (!permissions.isPlatformAdmin) {
    return NextResponse.json({ error: "Forbidden: Platform admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const oauthClientId = asString(body.oauthClientId);
  const oauthRedirectUri = asString(body.oauthRedirectUri);
  const oauthClientSecretRaw = body.oauthClientSecret;
  const serviceAccountEmail = asString(body.serviceAccountEmail);
  const serviceAccountPrivateKeyRaw = body.serviceAccountPrivateKey;
  const clearOauthClientSecret = !!body.clearOauthClientSecret;
  const clearServiceAccountPrivateKey = !!body.clearServiceAccountPrivateKey;

  const adminClient = createAdminClient();

  // Load existing so we can preserve secrets when client sends masked placeholders
  const { data: existingRows, error: existingError } = await (adminClient as any)
    .from("platform_settings")
    .select("setting_key, setting_value")
    .in("setting_key", [KEY_GOOGLE_OAUTH, KEY_GOOGLE_SERVICE_ACCOUNT]) as { data: PlatformSettingRow[] | null; error: any };

  if (existingError) {
    return NextResponse.json({ error: "Failed to load existing platform Google credentials" }, { status: 500 });
  }

  const existingOauth = (existingRows || []).find((r) => r.setting_key === KEY_GOOGLE_OAUTH)?.setting_value || {};
  const existingSa = (existingRows || []).find((r) => r.setting_key === KEY_GOOGLE_SERVICE_ACCOUNT)?.setting_value || {};

  // OAuth secret update logic
  let clientSecretEncrypted: string | null =
    asString(existingOauth.clientSecretEncrypted) || null;
  if (clearOauthClientSecret) {
    clientSecretEncrypted = null;
  } else if (!isMaskedSecret(oauthClientSecretRaw) && asString(oauthClientSecretRaw)) {
    clientSecretEncrypted = encrypt(asString(oauthClientSecretRaw)!);
  }

  // Service account private key update logic
  let privateKeyEncrypted: string | null =
    asString(existingSa.privateKeyEncrypted) || null;
  if (clearServiceAccountPrivateKey) {
    privateKeyEncrypted = null;
  } else if (!isMaskedSecret(serviceAccountPrivateKeyRaw) && asString(serviceAccountPrivateKeyRaw)) {
    privateKeyEncrypted = encrypt(asString(serviceAccountPrivateKeyRaw)!);
  }

  const now = new Date().toISOString();

  const upserts: Array<{ setting_key: string; setting_value: any; description: string; updated_at: string }> = [
    {
      setting_key: KEY_GOOGLE_OAUTH,
      setting_value: {
        clientId: oauthClientId ?? asString(existingOauth.clientId),
        redirectUri: oauthRedirectUri ?? asString(existingOauth.redirectUri),
        clientSecretEncrypted,
      },
      description: "Platform-wide Google OAuth credentials used as default for all tenants",
      updated_at: now,
    },
    {
      setting_key: KEY_GOOGLE_SERVICE_ACCOUNT,
      setting_value: {
        email: serviceAccountEmail ?? asString(existingSa.email),
        privateKeyEncrypted,
      },
      description: "Platform-wide Google Service Account used as default for server-to-server operations",
      updated_at: now,
    },
  ];

  const { error: upsertError } = await (adminClient as any)
    .from("platform_settings")
    .upsert(upserts, { onConflict: "setting_key" });

  if (upsertError) {
    return NextResponse.json({ error: "Failed to save platform Google credentials", details: upsertError?.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}


