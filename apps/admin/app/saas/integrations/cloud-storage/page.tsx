"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { 
  CloudIcon,
  FolderIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import React from "react";

const cloudStorageIntegrations = [
  {
    id: "dropbox",
    name: "Dropbox",
    description: "Allow users to connect their Dropbox accounts to store documents",
    icon: CloudIcon,
    status: "disconnected" as const,
    features: ["User Document Storage", "Auto-sync", "Secure OAuth"],
    requiredFor: ["Document Storage"],
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Allow users to connect their Google Drive accounts for document storage",
    icon: FolderIcon,
    status: "disconnected" as const,
    features: ["User Document Storage", "Folder Organization", "Secure OAuth"],
    requiredFor: ["Document Storage"],
  },
];

function StatusBadge({ status }: { status: "connected" | "disconnected" | "pending" }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircleIcon className="h-3 w-3" />
        Configured
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
        <ClockIcon className="h-3 w-3" />
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      <XCircleIcon className="h-3 w-3" />
      Not Configured
    </span>
  );
}

export default function CloudStorageIntegrationsPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Cloud Storage" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Cloud Storage Integrations
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Configure cloud storage providers to allow users to store their documents securely
          </p>
        </div>

        {/* Info Notice */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-start gap-3">
            <CloudIcon className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="font-medium text-amber-900 dark:text-amber-100">
                User Document Storage
              </h3>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                These integrations allow your users to connect their own cloud storage accounts. 
                Documents are stored in the user&apos;s account, not on your servers. This provides 
                better privacy and reduces your storage costs.
              </p>
            </div>
          </div>
        </div>

        {/* Integration Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {cloudStorageIntegrations.map((integration) => (
            <Link
              key={integration.id}
              href={`/saas/integrations/cloud-storage/${integration.id}`}
              className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700"
            >
              <div className="flex items-start justify-between">
                <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 p-3">
                  <integration.icon className="h-6 w-6 text-white" />
                </div>
                <StatusBadge status={integration.status} />
              </div>
              
              <h3 className="mt-4 text-lg font-semibold text-gray-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                {integration.name}
              </h3>
              
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {integration.description}
              </p>

              {/* Features */}
              <div className="mt-4 flex flex-wrap gap-2">
                {integration.features.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>

        {/* Setup Instructions */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Setup Instructions
          </h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <h3 className="font-medium text-gray-900 dark:text-white">
                Dropbox Setup
              </h3>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Go to the <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Dropbox App Console</a></li>
                <li>Create a new app with &quot;Scoped access&quot;</li>
                <li>Set permissions: files.content.write, files.content.read</li>
                <li>Add your redirect URI (e.g., https://yourdomain.com/api/storage/dropbox/callback)</li>
                <li>Copy the App Key and App Secret</li>
                <li>Enter them in the integration settings</li>
              </ol>
            </div>
            
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <h3 className="font-medium text-gray-900 dark:text-white">
                Google Drive Setup
              </h3>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Go to the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a></li>
                <li>Create OAuth 2.0 Client ID credentials</li>
                <li>Add authorized redirect URI (e.g., https://yourdomain.com/api/storage/drive/callback)</li>
                <li>Enable the Google Drive API</li>
                <li>Copy the Client ID and Client Secret</li>
                <li>Enter them in the integration settings</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


