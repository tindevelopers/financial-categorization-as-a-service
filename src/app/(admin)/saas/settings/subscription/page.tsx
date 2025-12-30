"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getSubscriptionType,
  updateSubscriptionType,
  getSubscriptionInfo,
  type SubscriptionType,
} from "@/app/actions/subscription";
import { SubscriptionTypeSelector } from "@/components/saas/SubscriptionTypeSelector";
import PageBreadcrumb from "@/components/breadcrumb/PageBreadcrumb";
import Button from "@/components/ui/button/Button";

export default function SubscriptionSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    subscriptionType: SubscriptionType | null;
    availableAuthMethods: string[];
    canUpgradeToEnterprise: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSubscriptionInfo();
  }, []);

  const loadSubscriptionInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getSubscriptionInfo();
      if (result.success && result.info) {
        setSubscriptionInfo(result.info);
      } else {
        setError(result.error || "Failed to load subscription information");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subscription information");
    } finally {
      setLoading(false);
    }
  };

  const handleSubscriptionTypeChange = async (newType: SubscriptionType) => {
    try {
      setUpdating(true);
      setError(null);
      setSuccess(null);

      const result = await updateSubscriptionType(newType);
      if (result.success) {
        setSuccess(`Subscription type updated to ${newType}`);
        await loadSubscriptionInfo();
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || "Failed to update subscription type");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update subscription type");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Subscription Settings" />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading subscription information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Subscription Settings" />

      {error && (
        <div className="mb-5 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-500/15 dark:text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-5 rounded-lg bg-green-50 p-4 text-green-800 dark:bg-green-500/15 dark:text-green-300">
          {success}
        </div>
      )}

      {subscriptionInfo && (
        <div className="space-y-6">
          {/* Current Subscription Type */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
              Current Subscription Type
            </h3>
            <div className="mb-4">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  subscriptionInfo.subscriptionType === "individual"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                    : subscriptionInfo.subscriptionType === "company"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                    : "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400"
                }`}
              >
                {subscriptionInfo.subscriptionType
                  ? subscriptionInfo.subscriptionType.charAt(0).toUpperCase() +
                    subscriptionInfo.subscriptionType.slice(1)
                  : "Not Set"}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {subscriptionInfo.subscriptionType === "individual" &&
                "You're using OAuth authentication. Perfect for personal use."}
              {subscriptionInfo.subscriptionType === "company" &&
                "You can use OAuth or bring your own Google credentials."}
              {subscriptionInfo.subscriptionType === "enterprise" &&
                "You're using enterprise credentials. Bring your own Google credentials required."}
            </p>
          </div>

          {/* Available Authentication Methods */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
              Available Authentication Methods
            </h3>
            <ul className="space-y-2">
              {subscriptionInfo.availableAuthMethods.map((method) => (
                <li key={method} className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <span className="mr-2 text-green-500">✓</span>
                  {method === "oauth" && "OAuth (Platform credentials)"}
                  {method === "byo_credentials" && "Bring Your Own Google Credentials"}
                  {method === "company_credentials" && "Company-provided Credentials"}
                </li>
              ))}
            </ul>
          </div>

          {/* Subscription Type Selector */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
              Change Subscription Type
            </h3>
            <SubscriptionTypeSelector
              currentType={subscriptionInfo.subscriptionType}
              onTypeChange={handleSubscriptionTypeChange}
              canUpgradeToEnterprise={subscriptionInfo.canUpgradeToEnterprise}
              updating={updating}
            />
          </div>

          {/* Help Link */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
              Need Help?
            </h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Learn more about subscription types and authentication methods.
            </p>
            <Button
              onClick={() => router.push("/saas/help/subscription-types")}
              size="sm"
              variant="outline"
            >
              View Documentation
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

