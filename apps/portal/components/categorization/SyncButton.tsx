"use client";

import React, { useState } from "react";
import { ArrowPathIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/catalyst";

interface SyncButtonProps {
  jobId: string;
  pendingCount?: number;
  onSyncComplete?: () => void;
  disabled?: boolean;
}

export default function SyncButton({
  jobId,
  pendingCount = 0,
  onSyncComplete,
  disabled = false,
}: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async (mode: "incremental" | "full_refresh", retryCount = 0) => {
    if (syncing || disabled) return;

    setSyncing(true);
    setError(null);
    setShowDropdown(false);

    const maxRetries = 3;
    const retryDelay = 1000 * (retryCount + 1); // Exponential backoff: 1s, 2s, 3s

    try {
      const response = await fetch(
        `/api/categorization/jobs/${jobId}/sync-sheets?mode=${mode}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // Retry on network errors or 5xx server errors
        if (
          retryCount < maxRetries &&
          (response.status >= 500 || response.status === 0)
        ) {
          console.warn(`Sync failed, retrying (${retryCount + 1}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          return handleSync(mode, retryCount + 1);
        }
        throw new Error(data.error || "Sync failed");
      }

      // Handle success case
      if (data.success !== false) {
        // Check for partial failures
        if (data.errors && data.errors.length > 0) {
          console.warn(`Sync completed with ${data.errors.length} errors:`, data.errors);
          setError(`Sync completed with ${data.errors.length} error(s). Check console for details.`);
        } else if (data.message) {
          // Show informational message (e.g., "No pending transactions to sync")
          console.log(data.message);
        }

        if (onSyncComplete) {
          onSyncComplete();
        }

        // Show success notification (you can enhance this with a toast library)
        console.log(`Sync completed: ${data.transactions_synced || 0} transactions synced`);
      }
    } catch (err: any) {
      // Retry on network errors
      if (retryCount < maxRetries && (err.name === "TypeError" || err.message.includes("fetch"))) {
        console.warn(`Network error, retrying (${retryCount + 1}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return handleSync(mode, retryCount + 1);
      }
      
      setError(err.message || "Sync failed");
      console.error("Sync error:", err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <Button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={disabled || syncing}
          color="blue"
        >
          <ArrowPathIcon
            className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`}
          />
          {syncing ? "Syncing..." : "Sync"}
          {pendingCount > 0 && !syncing && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 text-xs font-medium">
              {pendingCount}
            </span>
          )}
          <ChevronDownIcon className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 z-30">
            <div className="py-1">
              <button
                onClick={() => handleSync("incremental")}
                disabled={syncing || disabled}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-medium">Sync Changes</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Update only changed transactions
                </div>
              </button>
              <button
                onClick={() => handleSync("full_refresh")}
                disabled={syncing || disabled}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-medium">Refresh Entire Tab</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Complete refresh for consistency
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}

