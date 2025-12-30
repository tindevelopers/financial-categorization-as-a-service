"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageBreadcrumb from "@/components/breadcrumb/PageBreadcrumb";
import { AuthSetupGuide } from "@/components/auth/AuthSetupGuide";
import {
  getSubscriptionType,
  getAvailableAuthMethods,
  type SubscriptionType,
} from "@/app/actions/subscription";
import Button from "@/components/ui/button/Button";

export default function GoogleSheetsSetupPage() {
  const router = useRouter();
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionType | null>(null);
  const [authMethods, setAuthMethods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscriptionInfo();
  }, []);

  const loadSubscriptionInfo = async () => {
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
      console.error("Failed to load subscription info:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    // Redirect to connect endpoint based on subscription type
    if (subscriptionType === "individual" || authMethods.includes("oauth")) {
      // Use OAuth flow
      window.location.href = "/api/integrations/google-sheets/connect";
    } else {
      // For Company/Enterprise with BYO credentials, they should configure first
      router.push("/saas/settings/integrations");
    }
  };

  if (loading) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Google Sheets Setup" />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading setup information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Google Sheets Setup" />

      <div className="space-y-6">
        {/* Subscription Type Info */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h3 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
            Your Subscription: {subscriptionType ? subscriptionType.charAt(0).toUpperCase() + subscriptionType.slice(1) : "Not Set"}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Based on your subscription type, here&apos;s how to set up Google Sheets integration.
          </p>
        </div>

        {/* Auth Setup Guide */}
        <AuthSetupGuide />

        {/* Quick Connect Button (for Individual/OAuth) */}
        {(subscriptionType === "individual" || authMethods.includes("oauth")) && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
              Ready to Connect?
            </h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Click the button below to connect your Google account using OAuth.
            </p>
            <Button onClick={handleConnect}>Connect Google Sheets</Button>
          </div>
        )}

        {/* BYO Credentials Notice */}
        {subscriptionType === "company" && authMethods.includes("byo_credentials") && !authMethods.includes("oauth") && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
            <h3 className="mb-2 text-lg font-semibold text-amber-900 dark:text-amber-300">
              Configure Your Credentials First
            </h3>
            <p className="mb-4 text-sm text-amber-800 dark:text-amber-400">
              Your Company plan is configured to use your own Google credentials. Please configure
              them in Settings → Integrations before connecting.
            </p>
            <Button onClick={() => router.push("/saas/settings/integrations")} variant="outline">
              Go to Integration Settings
            </Button>
          </div>
        )}

        {subscriptionType === "enterprise" && (
          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-6 dark:border-purple-800 dark:bg-purple-900/20">
            <h3 className="mb-2 text-lg font-semibold text-purple-900 dark:text-purple-300">
              Enterprise Credentials Required
            </h3>
            <p className="mb-4 text-sm text-purple-800 dark:text-purple-400">
              Your Enterprise plan requires you to use your own Google credentials. Make sure they
              are configured in Settings → Integrations.
            </p>
            <Button onClick={() => router.push("/saas/settings/integrations")} variant="outline">
              Configure Credentials
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

