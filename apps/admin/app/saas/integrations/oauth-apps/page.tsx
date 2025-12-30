"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { 
  PlusIcon, 
  PencilIcon, 
  EyeIcon, 
  EyeSlashIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { TrashBinIcon as TrashIcon } from "@/icons";
import React, { useState, useEffect, useCallback } from "react";

interface EnterpriseTenant {
  id: string;
  name: string;
  domain?: string;
  subscription_type: string;
}

interface EnterpriseOAuthConfig {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_domain?: string;
  provider: string;
  custom_client_id: string | null;
  has_client_secret: boolean;
  custom_redirect_uri?: string;
  use_custom_credentials: boolean;
  is_enabled: boolean;
  dwd_subject_email?: string;
  updated_at: string;
}

export default function EnterpriseOAuthManagementPage() {
  const [enterpriseTenants, setEnterpriseTenants] = useState<EnterpriseTenant[]>([]);
  const [oauthConfigs, setOauthConfigs] = useState<EnterpriseOAuthConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { valid: boolean; message: string }>>({});
  
  const configureModal = useModal();
  const [selectedTenant, setSelectedTenant] = useState<EnterpriseTenant | null>(null);
  const [formData, setFormData] = useState({
    custom_client_id: "",
    custom_client_secret: "",
    custom_redirect_uri: "",
    dwd_subject_email: "",
    use_custom_credentials: true,
    is_enabled: true,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load enterprise tenants and their OAuth configurations
      const response = await fetch("/api/enterprise/oauth-credentials", {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setEnterpriseTenants(data.tenants || []);
        setOauthConfigs(data.configs || []);
      } else {
        console.error("Failed to load enterprise OAuth data");
      }
    } catch (error) {
      console.error("Error loading enterprise OAuth data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConfigureTenant = (tenant: EnterpriseTenant) => {
    setSelectedTenant(tenant);
    
    // Load existing config if available
    const existingConfig = oauthConfigs.find(c => c.tenant_id === tenant.id);
    if (existingConfig) {
      setFormData({
        custom_client_id: existingConfig.custom_client_id || "",
        custom_client_secret: existingConfig.has_client_secret ? "••••••••" : "",
        custom_redirect_uri: existingConfig.custom_redirect_uri || "",
        dwd_subject_email: existingConfig.dwd_subject_email || "",
        use_custom_credentials: existingConfig.use_custom_credentials,
        is_enabled: existingConfig.is_enabled,
      });
    } else {
      setFormData({
        custom_client_id: "",
        custom_client_secret: "",
        custom_redirect_uri: "",
        dwd_subject_email: "",
        use_custom_credentials: true,
        is_enabled: true,
      });
    }
    
    configureModal.openModal();
  };

  const handleSaveConfig = async () => {
    if (!selectedTenant) return;
    
    // Validate required fields
    if (!formData.custom_client_id.trim()) {
      alert("Client ID is required");
      return;
    }
    
    // Only require secret if this is a new config or user is updating it
    const existingConfig = oauthConfigs.find(c => c.tenant_id === selectedTenant.id);
    const isUpdatingSecret = formData.custom_client_secret !== "••••••••" && formData.custom_client_secret.trim() !== "";
    
    if (!existingConfig && !formData.custom_client_secret.trim()) {
      alert("Client Secret is required for new configurations");
      return;
    }
    
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        tenant_id: selectedTenant.id,
        provider: "google_sheets",
        custom_client_id: formData.custom_client_id.trim(),
        custom_redirect_uri: formData.custom_redirect_uri.trim() || null,
        dwd_subject_email: formData.dwd_subject_email.trim() || null,
        use_custom_credentials: formData.use_custom_credentials,
        is_enabled: formData.is_enabled,
      };
      
      // Only include secret if it's being updated
      if (isUpdatingSecret) {
        payload.custom_client_secret = formData.custom_client_secret.trim();
      }
      
      const response = await fetch("/api/enterprise/oauth-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        await loadData();
        configureModal.closeModal();
        setSelectedTenant(null);
      } else {
        const error = await response.json();
        alert(`Failed to save: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error saving OAuth config:", error);
      alert("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleTestCredentials = async (tenantId: string) => {
    setTesting(tenantId);
    setTestResults(prev => ({ ...prev, [tenantId]: { valid: false, message: "Testing..." } }));
    
    try {
      const response = await fetch("/api/enterprise/oauth-credentials/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tenant_id: tenantId, provider: "google_sheets" }),
      });
      
      const result = await response.json();
      setTestResults(prev => ({
        ...prev,
        [tenantId]: {
          valid: result.valid,
          message: result.message || (result.valid ? "Credentials are valid" : "Credentials are invalid"),
        },
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [tenantId]: { valid: false, message: "Test failed" },
      }));
    } finally {
      setTesting(null);
    }
  };

  const handleDeleteConfig = async (tenantId: string) => {
    if (!confirm("Are you sure you want to remove OAuth credentials for this tenant?")) {
      return;
    }
    
    try {
      const response = await fetch(`/api/enterprise/oauth-credentials?tenant_id=${tenantId}&provider=google_sheets`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (response.ok) {
        await loadData();
      } else {
        const error = await response.json();
        alert(`Failed to delete: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error deleting OAuth config:", error);
      alert("Failed to delete configuration");
    }
  };

  const getConfigForTenant = (tenantId: string) => {
    return oauthConfigs.find(c => c.tenant_id === tenantId);
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Enterprise OAuth Management" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
              Enterprise OAuth Management
            </h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Configure Google OAuth credentials for Enterprise and BYO-enabled tenants
            </p>
          </div>
          <Button onClick={loadData} variant="outline" disabled={loading}>
            <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Info Box */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex gap-3">
            <BuildingOffice2Icon className="h-5 w-5 flex-shrink-0 text-blue-500" />
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <p className="font-medium">Enterprise BYO (Bring Your Own) Credentials</p>
              <p className="mt-1">
                Enterprise tenants can use their own Google Cloud project for OAuth. This allows them to:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>Use their company branding on Google consent screens</li>
                <li>Store data in their own Google Workspace</li>
                <li>Maintain full control over API access and quotas</li>
                <li>Configure Domain-Wide Delegation for service account access</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500"></div>
          </div>
        )}

        {/* Enterprise Tenants List */}
        {!loading && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Enterprise Tenants ({enterpriseTenants.length})
            </h2>
            
            {enterpriseTenants.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-800 dark:bg-gray-900">
                <BuildingOffice2Icon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-gray-500 dark:text-gray-400">
                  No tenants found. Tenants appear here if they are marked as Enterprise or have BYO enabled (Google Sheets integration settings).
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <a
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                    href="/saas/admin/entity/tenant-management"
                  >
                    Go to Tenant Management
                  </a>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {enterpriseTenants.map((tenant) => {
                  const config = getConfigForTenant(tenant.id);
                  const testResult = testResults[tenant.id];
                  
                  return (
                    <div
                      key={tenant.id}
                      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
                    >
                      <div className="mb-4 flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {tenant.name}
                          </h3>
                          {tenant.domain && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {tenant.domain}
                            </p>
                          )}
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            config?.use_custom_credentials
                              ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          }`}
                        >
                          {config?.use_custom_credentials ? "BYO Configured" : "Platform OAuth"}
                        </span>
                      </div>
                      
                      {config ? (
                        <div className="mb-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">Client ID</span>
                            <span className="max-w-[200px] truncate font-mono text-xs text-gray-600 dark:text-gray-400">
                              {config.custom_client_id || "Not set"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">Client Secret</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                                {showSecrets[tenant.id] && config.has_client_secret
                                  ? "[stored securely]"
                                  : config.has_client_secret
                                  ? "••••••••"
                                  : "Not set"}
                              </span>
                              {config.has_client_secret && (
                                <button
                                  onClick={() =>
                                    setShowSecrets({ ...showSecrets, [tenant.id]: !showSecrets[tenant.id] })
                                  }
                                >
                                  {showSecrets[tenant.id] ? (
                                    <EyeSlashIcon className="h-4 w-4 text-gray-400" />
                                  ) : (
                                    <EyeIcon className="h-4 w-4 text-gray-400" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                          {config.dwd_subject_email && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500 dark:text-gray-400">DWD Subject</span>
                              <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                                {config.dwd_subject_email}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">Status</span>
                            <span
                              className={`text-xs font-medium ${
                                config.is_enabled ? "text-green-600" : "text-gray-500"
                              }`}
                            >
                              {config.is_enabled ? "Enabled" : "Disabled"}
                            </span>
                          </div>
                          
                          {/* Test Result */}
                          {testResult && (
                            <div
                              className={`mt-2 flex items-center gap-2 rounded-lg p-2 text-xs ${
                                testResult.valid
                                  ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                  : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                              }`}
                            >
                              {testResult.valid ? (
                                <CheckCircleIcon className="h-4 w-4" />
                              ) : (
                                <ExclamationCircleIcon className="h-4 w-4" />
                              )}
                              {testResult.message}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                          <ExclamationCircleIcon className="mb-1 inline h-4 w-4" /> No custom OAuth
                          credentials configured. This tenant is using platform OAuth.
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleConfigureTenant(tenant)}
                        >
                          <PencilIcon className="h-4 w-4" />
                          {config ? "Edit" : "Configure"}
                        </Button>
                        {config && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTestCredentials(tenant.id)}
                              disabled={testing === tenant.id}
                            >
                              {testing === tenant.id ? (
                                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                              ) : (
                                "Test"
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteConfig(tenant.id)}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Configure OAuth Modal */}
      <Modal isOpen={configureModal.isOpen} onClose={configureModal.closeModal} className="m-4 max-w-[600px]">
        <div className="p-6">
          <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Configure OAuth for {selectedTenant?.name}
          </h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="client-id">Google OAuth Client ID *</Label>
              <Input
                id="client-id"
                type="text"
                value={formData.custom_client_id}
                onChange={(e) => setFormData({ ...formData, custom_client_id: e.target.value })}
                placeholder="xxxxx.apps.googleusercontent.com"
              />
            </div>
            <div>
              <Label htmlFor="client-secret">
                Google OAuth Client Secret {oauthConfigs.find(c => c.tenant_id === selectedTenant?.id) ? "(leave blank to keep existing)" : "*"}
              </Label>
              <div className="relative">
                <Input
                  id="client-secret"
                  type={showSecrets["modal"] ? "text" : "password"}
                  value={formData.custom_client_secret}
                  onChange={(e) => setFormData({ ...formData, custom_client_secret: e.target.value })}
                  placeholder={formData.custom_client_secret === "••••••••" ? "Existing secret (enter new to update)" : "Enter client secret"}
                />
                <button
                  type="button"
                  onClick={() => setShowSecrets({ ...showSecrets, modal: !showSecrets["modal"] })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showSecrets["modal"] ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="redirect-uri">Custom Redirect URI (optional)</Label>
              <Input
                id="redirect-uri"
                type="url"
                value={formData.custom_redirect_uri}
                onChange={(e) => setFormData({ ...formData, custom_redirect_uri: e.target.value })}
                placeholder="https://yourdomain.com/api/integrations/google-sheets/callback"
              />
              <p className="mt-1 text-xs text-gray-500">
                Leave blank to use the platform default redirect URI
              </p>
            </div>
            <div>
              <Label htmlFor="dwd-email">Domain-Wide Delegation Subject Email (optional)</Label>
              <Input
                id="dwd-email"
                type="email"
                value={formData.dwd_subject_email}
                onChange={(e) => setFormData({ ...formData, dwd_subject_email: e.target.value })}
                placeholder="admin@company.com"
              />
              <p className="mt-1 text-xs text-gray-500">
                For service account impersonation in Google Workspace
              </p>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.use_custom_credentials}
                  onChange={(e) => setFormData({ ...formData, use_custom_credentials: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-brand-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Use custom credentials</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_enabled}
                  onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-brand-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Enabled</span>
              </label>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={configureModal.closeModal} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSaveConfig} disabled={saving} className="flex-1">
                {saving ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
