"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { 
  CpuChipIcon, 
  DocumentTextIcon, 
  TableCellsIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import React from "react";

const aiIntegrations = [
  {
    id: "google-document-ai",
    name: "Google Document AI",
    description: "Extract structured data from invoices, receipts, and documents using Google's Document AI",
    icon: DocumentTextIcon,
    status: "disconnected" as const,
    features: ["Invoice Parsing", "Receipt OCR", "Multi-language Support", "High Accuracy"],
    requiredFor: ["Invoice Upload", "OCR Processing"],
  },
  {
    id: "openai",
    name: "OpenAI / Vercel AI Gateway",
    description: "AI-powered transaction categorization using GPT models via Vercel AI Gateway",
    icon: CpuChipIcon,
    status: "disconnected" as const,
    features: ["Smart Categorization", "Context-aware", "Learning from User Feedback"],
    requiredFor: ["Transaction Categorization"],
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    description: "Export categorized transactions directly to Google Sheets for easy sharing with accountants",
    icon: TableCellsIcon,
    status: "disconnected" as const,
    features: ["Direct Export", "Formatted Output", "Sharing Controls"],
    requiredFor: ["Export to Google Sheets"],
  },
];

function StatusBadge({ status }: { status: "connected" | "disconnected" | "pending" }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircleIcon className="h-3 w-3" />
        Connected
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
      Not Connected
    </span>
  );
}

export default function AIServicesIntegrationsPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="AI Services" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            AI Services Integrations
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Configure AI and machine learning services for document processing, categorization, and exports
          </p>
        </div>

        {/* Important Notice */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex items-start gap-3">
            <CpuChipIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100">
                Required for Core Features
              </h3>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                These integrations power the invoice OCR, transaction categorization, and export features. 
                Configure at least Google Document AI and OpenAI to enable full functionality.
              </p>
            </div>
          </div>
        </div>

        {/* Integration Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {aiIntegrations.map((integration) => (
            <Link
              key={integration.id}
              href={`/saas/integrations/ai-services/${integration.id}`}
              className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700"
            >
              <div className="flex items-start justify-between">
                <div className="rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 p-3">
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
                {integration.features.slice(0, 3).map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  >
                    {feature}
                  </span>
                ))}
              </div>

              {/* Required For */}
              <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Required for: {integration.requiredFor.join(", ")}
                </p>
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
                1. Google Document AI
              </h3>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Go to the <a href="https://console.cloud.google.com/ai/document-ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a></li>
                <li>Create or select a project</li>
                <li>Enable the Document AI API</li>
                <li>Create an Invoice Parser processor</li>
                <li>Create a Service Account with Document AI permissions</li>
                <li>Download the JSON key file</li>
                <li>Enter the credentials in the integration settings</li>
              </ol>
            </div>
            
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <h3 className="font-medium text-gray-900 dark:text-white">
                2. OpenAI / Vercel AI Gateway
              </h3>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Get an API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenAI Platform</a></li>
                <li>Or configure via <a href="https://vercel.com/docs/ai-gateway" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Vercel AI Gateway</a> for enhanced monitoring</li>
                <li>Enter the API key in the integration settings</li>
              </ol>
            </div>

            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <h3 className="font-medium text-gray-900 dark:text-white">
                3. Google Sheets
              </h3>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Go to the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console Credentials</a></li>
                <li>Create OAuth 2.0 Client ID credentials</li>
                <li>Add authorized redirect URIs</li>
                <li>Enable the Google Sheets API</li>
                <li>Enter the Client ID and Secret in the integration settings</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


