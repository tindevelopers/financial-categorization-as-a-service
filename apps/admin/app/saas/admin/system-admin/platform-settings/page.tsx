"use client";

import React, { useEffect, useMemo, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import TextArea from "@/components/form/input/TextArea";
import Button from "@/components/ui/button/Button";

type GoogleCredsResponse = {
  success: true;
  oauth: {
    clientId: string;
    redirectUri: string;
    hasClientSecret: boolean;
    clientSecretMasked: string;
    updatedAt: string | null;
  };
  serviceAccount: {
    email: string;
    hasPrivateKey: boolean;
    privateKeyMasked: string;
    updatedAt: string | null;
  };
  summary: {
    oauthConfigured: boolean;
    serviceAccountConfigured: boolean;
  };
};

export default function PlatformSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [oauthRedirectUri, setOauthRedirectUri] = useState("");
  const [serviceAccountEmail, setServiceAccountEmail] = useState("");
  const [serviceAccountPrivateKey, setServiceAccountPrivateKey] = useState("");

  const [hasOauthSecret, setHasOauthSecret] = useState(false);
  const [hasServiceAccountKey, setHasServiceAccountKey] = useState(false);

  const configuredBadges = useMemo(() => {
    const oauthOk = oauthClientId.trim() && hasOauthSecret;
    const saOk = serviceAccountEmail.trim() && hasServiceAccountKey;
    return { oauthOk, saOk, allOk: !!oauthOk && !!saOk };
  }, [oauthClientId, hasOauthSecret, serviceAccountEmail, hasServiceAccountKey]);

  async function load() {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/platform/google-credentials", {
        method: "GET",
        credentials: "include",
      });
      const data = (await res.json()) as GoogleCredsResponse | { error: string };
      if (!res.ok) throw new Error((data as any)?.error || "Failed to load platform credentials");

      const d = data as GoogleCredsResponse;
      setOauthClientId(d.oauth.clientId || "");
      setOauthRedirectUri(d.oauth.redirectUri || "");
      setHasOauthSecret(!!d.oauth.hasClientSecret);
      setOauthClientSecret(d.oauth.hasClientSecret ? "••••••••" : "");

      setServiceAccountEmail(d.serviceAccount.email || "");
      setHasServiceAccountKey(!!d.serviceAccount.hasPrivateKey);
      setServiceAccountPrivateKey(d.serviceAccount.hasPrivateKey ? "••••••••" : "");
    } catch (e: any) {
      setError(e?.message || "Failed to load platform credentials");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/platform/google-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          oauthClientId,
          oauthClientSecret,
          oauthRedirectUri,
          serviceAccountEmail,
          serviceAccountPrivateKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save settings");
      setSuccessMsg("Platform Google credentials saved");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function clearOauthSecret() {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/platform/google-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          clearOauthClientSecret: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to clear OAuth secret");
      setSuccessMsg("OAuth client secret cleared");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to clear OAuth secret");
    } finally {
      setSaving(false);
    }
  }

  async function clearServiceAccountKey() {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/platform/google-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          clearServiceAccountPrivateKey: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to clear service account key");
      setSuccessMsg("Service account private key cleared");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to clear service account key");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Platform Settings" />

      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
              Platform Settings
            </h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Configure platform-wide integrations used by default for all individuals and businesses.
              Enterprise BYO credentials can still override these per tenant.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                configuredBadges.allOk
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
              }`}
            >
              {configuredBadges.allOk ? "Google Configured" : "Google Not Fully Configured"}
            </span>
            <Button variant="outline" size="sm" onClick={load} disabled={loading || saving}>
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="text-gray-500 dark:text-gray-400">Loading…</div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        {successMsg ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200">
            {successMsg}
          </div>
        ) : null}

        {/* Google OAuth */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Google OAuth (User Connections)
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Used for individual user OAuth flows (connect Google account).
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                configuredBadges.oauthOk
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
              }`}
            >
              {configuredBadges.oauthOk ? "Configured" : "Missing"}
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="google-oauth-client-id">Client ID</Label>
              <Input
                id="google-oauth-client-id"
                value={oauthClientId}
                onChange={(e) => setOauthClientId(e.target.value)}
                placeholder="1234567890-abcxyz.apps.googleusercontent.com"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="google-oauth-client-secret">Client Secret</Label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  id="google-oauth-client-secret"
                  type="password"
                  value={oauthClientSecret}
                  onChange={(e) => setOauthClientSecret(e.target.value)}
                  placeholder={hasOauthSecret ? "••••••••" : "Enter client secret"}
                  className="h-11 flex-1 rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                />
                {hasOauthSecret ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearOauthSecret}
                    disabled={saving}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Leaving this as <span className="font-mono">••••••••</span> keeps the existing secret.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="google-oauth-redirect-uri">Redirect URI</Label>
              <Input
                id="google-oauth-redirect-uri"
                value={oauthRedirectUri}
                onChange={(e) => setOauthRedirectUri(e.target.value)}
                placeholder="https://your-domain.com/api/integrations/google-sheets/callback"
              />
            </div>
          </div>
        </div>

        {/* Service Account */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Google Service Account (Server-to-Server)
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Used for company exports/sync (server-to-server). For Workspace DWD enterprise mode, tenants can override with BYO.
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                configuredBadges.saOk
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
              }`}
            >
              {configuredBadges.saOk ? "Configured" : "Missing"}
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="google-sa-email">Service Account Email</Label>
              <Input
                id="google-sa-email"
                value={serviceAccountEmail}
                onChange={(e) => setServiceAccountEmail(e.target.value)}
                placeholder="service-account@your-project.iam.gserviceaccount.com"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="google-sa-private-key">Private Key</Label>
              <TextArea
                id="google-sa-private-key"
                rows={8}
                value={serviceAccountPrivateKey}
                onChange={(v) => setServiceAccountPrivateKey(v)}
                placeholder={hasServiceAccountKey ? "••••••••" : "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Leaving this as <span className="font-mono">••••••••</span> keeps the existing key.
                </p>
                {hasServiceAccountKey ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearServiceAccountKey}
                    disabled={saving}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={load} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Platform Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}


