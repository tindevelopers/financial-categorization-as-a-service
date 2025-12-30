"use client";

import PageBreadcrumb from "@/components/breadcrumb/PageBreadcrumb";
import Link from "next/link";
import Button from "@/components/ui/button/Button";

export default function SubscriptionTypesHelpPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Subscription Types" />

      <div className="space-y-6">
        {/* Overview */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="mb-4 text-2xl font-bold text-gray-800 dark:text-white/90">
            Understanding Subscription Types
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Our platform offers three subscription types, each designed for different needs and
            authentication requirements. Choose the one that best fits your use case.
          </p>
        </div>

        {/* Individual Plan */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="mb-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 font-bold text-lg">I</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-blue-900 dark:text-blue-300">Individual Plan</h3>
              <p className="text-sm text-blue-700 dark:text-blue-400">Perfect for personal use</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                Authentication Method
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-400">
                OAuth only - Uses platform-managed credentials for quick and easy setup.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Features</h4>
              <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
                <li>Simple OAuth connection</li>
                <li>Platform-managed credentials</li>
                <li>Quick setup - no configuration needed</li>
                <li>Perfect for personal use</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                When to Use
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-400">
                Ideal for individuals who want a simple, hassle-free authentication setup. Just
                connect your Google account and you&apos;re ready to go.
              </p>
            </div>
          </div>
        </div>

        {/* Company Plan */}
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/20">
          <div className="mb-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <span className="text-green-600 dark:text-green-400 font-bold text-lg">C</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-green-900 dark:text-green-300">Company Plan</h3>
              <p className="text-sm text-green-700 dark:text-green-400">
                Flexible authentication options
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-green-900 dark:text-green-300 mb-2">
                Authentication Methods
              </h4>
              <p className="text-sm text-green-800 dark:text-green-400 mb-2">
                Choose from three options:
              </p>
              <ul className="text-sm text-green-800 dark:text-green-400 space-y-1 list-disc list-inside">
                <li>
                  <strong>OAuth:</strong> Use platform-managed credentials (same as Individual)
                </li>
                <li>
                  <strong>Bring Your Own Credentials:</strong> Use your own Google OAuth app
                </li>
                <li>
                  <strong>Company Credentials:</strong> Use credentials provided by your company
                  admin
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-green-900 dark:text-green-300 mb-2">Features</h4>
              <ul className="text-sm text-green-800 dark:text-green-400 space-y-1 list-disc list-inside">
                <li>Multiple authentication options</li>
                <li>More control over credentials</li>
                <li>Company-wide credential management</li>
                <li>Easy upgrade/downgrade from Individual</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-green-900 dark:text-green-300 mb-2">
                When to Use
              </h4>
              <p className="text-sm text-green-800 dark:text-green-400">
                Perfect for companies that want flexibility in how they authenticate. You can use
                simple OAuth or bring your own credentials for more control.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-green-900 dark:text-green-300 mb-2">
                Setting Up BYO Credentials
              </h4>
              <ol className="text-sm text-green-800 dark:text-green-400 space-y-1 list-decimal list-inside">
                <li>Create a Google Cloud Project</li>
                <li>Set up OAuth 2.0 credentials</li>
                <li>Add your Client ID and Client Secret in Settings → Integrations</li>
                <li>Configure redirect URIs as needed</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Enterprise Plan */}
        <div className="rounded-2xl border border-purple-200 bg-purple-50 p-6 dark:border-purple-800 dark:bg-purple-900/20">
          <div className="mb-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
              <span className="text-purple-600 dark:text-purple-400 font-bold text-lg">E</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-purple-900 dark:text-purple-300">
                Enterprise Plan
              </h3>
              <p className="text-sm text-purple-700 dark:text-purple-400">
                Full control with BYO credentials required
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-purple-900 dark:text-purple-300 mb-2">
                Authentication Method
              </h4>
              <p className="text-sm text-purple-800 dark:text-purple-400">
                Bring Your Own Google Credentials - Required. You must configure your own Google
                OAuth credentials before upgrading to Enterprise.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-purple-900 dark:text-purple-300 mb-2">Features</h4>
              <ul className="text-sm text-purple-800 dark:text-purple-400 space-y-1 list-disc list-inside">
                <li>Full control over authentication</li>
                <li>Enterprise-grade security</li>
                <li>Custom credential management</li>
                <li>Explicit upgrade process with verification</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-purple-900 dark:text-purple-300 mb-2">
                When to Use
              </h4>
              <p className="text-sm text-purple-800 dark:text-purple-400">
                Ideal for enterprises that require full control over their authentication
                credentials and need enterprise-grade security.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-purple-900 dark:text-purple-300 mb-2">
                Upgrade Requirements
              </h4>
              <p className="text-sm text-purple-800 dark:text-purple-400 mb-2">
                Before upgrading to Enterprise, you must:
              </p>
              <ol className="text-sm text-purple-800 dark:text-purple-400 space-y-1 list-decimal list-inside">
                <li>Configure Google OAuth credentials in Settings → Integrations</li>
                <li>Verify credentials are working correctly</li>
                <li>Confirm the upgrade (explicit confirmation required)</li>
              </ol>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="mb-4 text-xl font-bold text-gray-800 dark:text-white/90">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                Can I switch between Individual and Company easily?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Yes! You can switch between Individual and Company plans with a single click in
                Settings → Subscription. No verification is needed for these switches.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                What happens when I upgrade to Enterprise?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enterprise requires explicit confirmation and credential verification. You&apos;ll
                see a confirmation modal, and the system will verify that your Google credentials
                are properly configured before completing the upgrade.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                Do I need to configure credentials for Individual or Company plans?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No! Individual and Company plans can use OAuth with platform-managed credentials.
                Company plans also give you the option to bring your own credentials if you prefer.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                How do I set up my own Google credentials?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Go to Settings → Integrations and follow the setup guide. You&apos;ll need to
                create a Google Cloud Project, set up OAuth 2.0 credentials, and add your Client ID
                and Client Secret.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link href="/saas/settings/subscription">
            <Button>Go to Subscription Settings</Button>
          </Link>
          <Link href="/saas/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

