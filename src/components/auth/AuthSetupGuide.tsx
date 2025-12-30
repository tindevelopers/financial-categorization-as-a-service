"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getSubscriptionType,
  getAvailableAuthMethods,
  type SubscriptionType,
} from "@/app/actions/subscription";
import Button from "@/components/ui/button/Button";

export function AuthSetupGuide() {
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionType | null>(null);
  const [authMethods, setAuthMethods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuthInfo();
  }, []);

  const loadAuthInfo = async () => {
    try {
      setLoading(true);
      const [typeResult, methodsResult] = await Promise.all([
        getSubscriptionType(),
        getAvailableAuthMethods(),
      ]);

      if (typeResult.success) {
        setSubscriptionType(typeResult.subscriptionType || null);
      }
      if (methodsResult.success && methodsResult.authMethods) {
        setAuthMethods(methodsResult.authMethods);
      }
    } catch (error) {
      console.error("Failed to load auth info:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
        Authentication Setup Guide
      </h3>

      {subscriptionType === "individual" && (
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
              Individual Plan - OAuth Setup
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-400 mb-4">
              Your Individual plan uses OAuth authentication. Simply connect your Google account
              when you need to integrate with Google Sheets or Google Drive.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                Steps to connect:
              </p>
              <ol className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-decimal list-inside">
                <li>Go to Integrations → Google Sheets or Google Drive</li>
                <li>Click &quot;Connect&quot; button</li>
                <li>Authorize with your Google account</li>
                <li>You&apos;re all set!</li>
              </ol>
            </div>
            <div className="mt-4">
              <Link href="/saas/integrations/google-sheets">
                <Button size="sm">Go to Integrations</Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {subscriptionType === "company" && (
        <div className="space-y-4">
          <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
            <h4 className="font-medium text-green-900 dark:text-green-300 mb-2">
              Company Plan - Choose Your Authentication Method
            </h4>
            <p className="text-sm text-green-800 dark:text-green-400 mb-4">
              Your Company plan gives you flexibility. Choose one of these options:
            </p>

            <div className="space-y-4">
              {/* Option 1: OAuth */}
              {authMethods.includes("oauth") && (
                <div className="border border-green-200 rounded-lg p-3 bg-white dark:bg-gray-800 dark:border-green-800">
                  <h5 className="font-medium text-gray-900 dark:text-white mb-1">
                    Option 1: OAuth (Simple)
                  </h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Use platform-managed OAuth credentials. Quick and easy setup.
                  </p>
                  <Link href="/saas/integrations/google-sheets">
                    <Button size="sm" variant="outline">
                      Connect with OAuth
                    </Button>
                  </Link>
                </div>
              )}

              {/* Option 2: BYO Credentials */}
              {authMethods.includes("byo_credentials") && (
                <div className="border border-green-200 rounded-lg p-3 bg-white dark:bg-gray-800 dark:border-green-800">
                  <h5 className="font-medium text-gray-900 dark:text-white mb-1">
                    Option 2: Bring Your Own Google Credentials
                  </h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Use your own Google OAuth app credentials for more control.
                  </p>
                  <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside mb-2">
                    <li>Create a Google Cloud Project</li>
                    <li>Set up OAuth 2.0 credentials</li>
                    <li>Add credentials in Settings → Integrations</li>
                  </ol>
                  <Link href="/saas/settings/integrations">
                    <Button size="sm" variant="outline">
                      Configure Credentials
                    </Button>
                  </Link>
                </div>
              )}

              {/* Option 3: Company Credentials */}
              {authMethods.includes("company_credentials") && (
                <div className="border border-green-200 rounded-lg p-3 bg-white dark:bg-gray-800 dark:border-green-800">
                  <h5 className="font-medium text-gray-900 dark:text-white mb-1">
                    Option 3: Use Company-Provided Credentials
                  </h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Your company administrator has configured credentials for you.
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Contact your admin if you need help accessing company credentials.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {subscriptionType === "enterprise" && (
        <div className="space-y-4">
          <div className="rounded-lg bg-purple-50 p-4 dark:bg-purple-900/20">
            <h4 className="font-medium text-purple-900 dark:text-purple-300 mb-2">
              Enterprise Plan - BYO Credentials Required
            </h4>
            <p className="text-sm text-purple-800 dark:text-purple-400 mb-4">
              Your Enterprise plan requires you to bring your own Google credentials. Make sure
              they are configured before connecting integrations.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium text-purple-900 dark:text-purple-300">
                Setup Steps:
              </p>
              <ol className="text-sm text-purple-800 dark:text-purple-400 space-y-1 list-decimal list-inside">
                <li>Create a Google Cloud Project</li>
                <li>Set up OAuth 2.0 credentials</li>
                <li>Configure credentials in Settings → Integrations</li>
                <li>Connect your integrations</li>
              </ol>
            </div>
            <div className="mt-4">
              <Link href="/saas/settings/integrations">
                <Button size="sm">Configure Credentials</Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {!subscriptionType && (
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Please set your subscription type in Settings to see authentication setup options.
          </p>
          <div className="mt-4">
            <Link href="/saas/settings/subscription">
              <Button size="sm" variant="outline">
                Go to Subscription Settings
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

