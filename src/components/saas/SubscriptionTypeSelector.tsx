"use client";

import { useState } from "react";
import { type SubscriptionType } from "@/app/actions/subscription";
import Button from "@/components/ui/button/Button";

interface SubscriptionTypeSelectorProps {
  currentType: SubscriptionType | null;
  onTypeChange: (type: SubscriptionType) => Promise<void>;
  canUpgradeToEnterprise?: boolean;
  updating?: boolean;
}

export function SubscriptionTypeSelector({
  currentType,
  onTypeChange,
  canUpgradeToEnterprise = false,
  updating = false,
}: SubscriptionTypeSelectorProps) {
  const [showEnterpriseConfirm, setShowEnterpriseConfirm] = useState(false);

  const handleTypeChange = async (newType: SubscriptionType) => {
    // For Enterprise, show confirmation modal
    if (newType === "enterprise") {
      if (!canUpgradeToEnterprise) {
        alert(
          "Enterprise requires Google credentials to be configured. Please set up your credentials first in Settings > Integrations."
        );
        return;
      }
      setShowEnterpriseConfirm(true);
      return;
    }

    // For Individual ↔ Company, direct change
    await onTypeChange(newType);
  };

  const confirmEnterpriseUpgrade = async () => {
    setShowEnterpriseConfirm(false);
    await onTypeChange("enterprise");
  };

  return (
    <div className="space-y-4">
      {/* Individual Option */}
      <div
        className={`rounded-lg border p-4 transition-all ${
          currentType === "individual"
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-gray-200 dark:border-gray-700"
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-gray-800 dark:text-white/90">Individual</h4>
              {currentType === "individual" && (
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                  Current
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              OAuth authentication only. Perfect for personal use.
            </p>
            <ul className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
              <li>• Simple OAuth connection</li>
              <li>• Platform-managed credentials</li>
              <li>• Quick setup</li>
            </ul>
          </div>
          {currentType !== "individual" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleTypeChange("individual")}
              disabled={updating}
            >
              Switch to Individual
            </Button>
          )}
        </div>
      </div>

      {/* Company Option */}
      <div
        className={`rounded-lg border p-4 transition-all ${
          currentType === "company"
            ? "border-green-500 bg-green-50 dark:bg-green-900/20"
            : "border-gray-200 dark:border-gray-700"
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-gray-800 dark:text-white/90">Company</h4>
              {currentType === "company" && (
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded">
                  Current
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Bring your own Google credentials OR use company-provided credentials.
            </p>
            <ul className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
              <li>• OAuth or BYO credentials</li>
              <li>• Company-provided credentials option</li>
              <li>• More flexibility</li>
            </ul>
          </div>
          {currentType !== "company" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleTypeChange("company")}
              disabled={updating}
            >
              Switch to Company
            </Button>
          )}
        </div>
      </div>

      {/* Enterprise Option */}
      <div
        className={`rounded-lg border p-4 transition-all ${
          currentType === "enterprise"
            ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
            : "border-gray-200 dark:border-gray-700"
        } ${!canUpgradeToEnterprise && currentType !== "enterprise" ? "opacity-60" : ""}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-gray-800 dark:text-white/90">Enterprise</h4>
              {currentType === "enterprise" && (
                <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                  Current
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Requires bring your own Google credentials. Explicit selection required.
            </p>
            <ul className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
              <li>• BYO Google credentials required</li>
              <li>• Full control over authentication</li>
              <li>• Enterprise-grade security</li>
            </ul>
            {!canUpgradeToEnterprise && currentType !== "enterprise" && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                ⚠️ Google credentials must be configured first
              </p>
            )}
          </div>
          {currentType !== "enterprise" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleTypeChange("enterprise")}
              disabled={updating || !canUpgradeToEnterprise}
            >
              Upgrade to Enterprise
            </Button>
          )}
        </div>
      </div>

      {/* Enterprise Confirmation Modal */}
      {showEnterpriseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
              Confirm Enterprise Upgrade
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Enterprise subscription requires you to bring your own Google credentials. Make
              sure you have configured your Google OAuth credentials before proceeding.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowEnterpriseConfirm(false)}
                disabled={updating}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmEnterpriseUpgrade}
                disabled={updating}
              >
                {updating ? "Upgrading..." : "Confirm Upgrade"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

