"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/button/Button";
import {
  BuildingOffice2Icon,
  GlobeAltIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  LinkIcon,
  InformationCircleIcon,
  UserPlusIcon,
  CreditCardIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { getTenantById } from "@/app/actions/tenants";
import type { Database } from "@/core/database";

type Tenant = Database["public"]["Tables"]["tenants"]["Row"] & {
  userCount?: number;
  workspaceCount?: number;
};

interface TenantSettings {
  provider: string;
  custom_client_id?: string;
  custom_client_secret?: string;
  custom_redirect_uri?: string;
  airtable_api_key?: string;
  airtable_base_id?: string;
  airtable_table_name?: string;
  use_custom_credentials?: boolean;
  is_enabled?: boolean;
  default_sharing_permission?: "reader" | "writer";
}

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function TenantManagementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantSettings, setTenantSettings] = useState<TenantSettings[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    if (tenantId) {
      loadTenant();
      loadTenantSettings();
    }
  }, [tenantId]);

  const loadTenant = async () => {
    try {
      setLoading(true);
      setError(null);
      const tenantData = await getTenantById(tenantId);
      setTenant(tenantData);
    } catch (err: any) {
      console.error("Error loading tenant:", err);
      setError(err.message || "Failed to load tenant");
    } finally {
      setLoading(false);
    }
  };

  const loadTenantSettings = async () => {
    try {
      setLoadingSettings(true);
      // Fetch tenant integration settings
      const response = await fetch(`/api/admin/tenant-settings/${tenantId}/integrations`);
      if (response.ok) {
        const data = await response.json();
        setTenantSettings(data.settings || []);
      } else {
        console.error("Failed to load tenant settings");
      }
    } catch (err) {
      console.error("Error loading tenant settings:", err);
    } finally {
      setLoadingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
            <p className="text-red-800 dark:text-red-200">
              {error || "Tenant not found"}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Link href="/saas/admin/entity/organization-management">
            <Button variant="outline">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Organizations
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const googleSettings = tenantSettings.find((s) => s.provider === "google_sheets");
  const airtableSettings = tenantSettings.find((s) => s.provider === "airtable");
  const isCompany = tenant.tenant_type === "company";

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/saas/admin/entity/organization-management">
              <Button variant="outline" size="sm">
                <ArrowLeftIcon className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {tenant.name}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Manage tenant settings and configuration
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              tenant.status === "active"
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                : tenant.status === "suspended"
                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
            }`}
          >
            {tenant.status}
          </span>
          {tenant.plan && (
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
              {tenant.plan}
            </span>
          )}
        </div>
      </div>

      {/* Tenant Info Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Tenant Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Domain</p>
            <p className="font-medium text-gray-900 dark:text-white">{tenant.domain}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Type</p>
            <p className="font-medium text-gray-900 dark:text-white capitalize">
              {tenant.tenant_type || "company"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Region</p>
            <p className="font-medium text-gray-900 dark:text-white">{tenant.region || "N/A"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {formatDate(tenant.created_at)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Users</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {tenant.userCount || 0}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Workspaces</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {tenant.workspaceCount || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Subscription & Plan Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <CreditCardIcon className="h-5 w-5" />
            Subscription & Plan
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Current subscription and plan details
          </p>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30`}>
              <SparklesIcon className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {tenant.plan || "Free"} Plan
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Status: {tenant.status}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Integrations Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Integrations
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Connected services and integration settings
          </p>
        </div>
        <div className="p-6 space-y-6">
          {/* Google Sheets Integration */}
          <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white dark:bg-zinc-700 rounded-lg flex items-center justify-center shadow-sm">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="2" fill="#0F9D58" />
                  <rect x="5" y="5" width="14" height="14" rx="1" fill="#FFFFFF" />
                  <rect x="7" y="7" width="4" height="2" fill="#34A853" />
                  <rect x="13" y="7" width="4" height="2" fill="#34A853" />
                  <rect x="7" y="11" width="4" height="2" fill="#34A853" />
                  <rect x="13" y="11" width="4" height="2" fill="#34A853" />
                  <rect x="7" y="15" width="4" height="2" fill="#34A853" />
                  <rect x="13" y="15" width="4" height="2" fill="#34A853" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Google Sheets</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Export transactions to Google Sheets
                </p>
                {loadingSettings ? (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-500">Loading...</span>
                  </div>
                ) : googleSettings ? (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600 dark:text-green-400">
                        Configured
                      </span>
                    </div>
                    {googleSettings.use_custom_credentials && (
                      <p className="text-xs text-gray-500">
                        Using custom OAuth credentials
                      </p>
                    )}
                    {googleSettings.default_sharing_permission && (
                      <p className="text-xs text-gray-500">
                        Default sharing: {googleSettings.default_sharing_permission}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2">
                    <ExclamationCircleIcon className="h-4 w-4 text-amber-500" />
                    <span className="text-sm text-amber-600 dark:text-amber-400">
                      Not configured
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Airtable Integration */}
          <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white dark:bg-zinc-700 rounded-lg flex items-center justify-center shadow-sm">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="4" fill="#FCB400" />
                  <rect x="6" y="6" width="5" height="5" rx="1" fill="#FFFFFF" />
                  <rect x="13" y="6" width="5" height="5" rx="1" fill="#FFFFFF" />
                  <rect x="6" y="13" width="5" height="5" rx="1" fill="#FFFFFF" />
                  <rect x="13" y="13" width="5" height="5" rx="1" fill="#FFFFFF" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Airtable</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Sync transactions to Airtable
                </p>
                {loadingSettings ? (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-500">Loading...</span>
                  </div>
                ) : airtableSettings ? (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600 dark:text-green-400">
                        Configured
                      </span>
                    </div>
                    {airtableSettings.airtable_base_id && (
                      <p className="text-xs text-gray-500">
                        Base ID: {airtableSettings.airtable_base_id}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2">
                    <ExclamationCircleIcon className="h-4 w-4 text-amber-500" />
                    <span className="text-sm text-amber-600 dark:text-amber-400">
                      Not configured
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex gap-2">
              <InformationCircleIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Integration settings are managed by the tenant owner. As a platform admin, you can
                view the configuration but changes should be made by the tenant owner through their
                settings page.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link href={`/saas/admin/entity/user-management?tenant=${tenant.id}`}>
            <Button variant="outline">
              <UserGroupIcon className="h-4 w-4 mr-2" />
              View Users
            </Button>
          </Link>
          <Link href={`/saas/admin/entity/organization-management`}>
            <Button variant="outline">
              <BuildingOffice2Icon className="h-4 w-4 mr-2" />
              View Workspaces
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

