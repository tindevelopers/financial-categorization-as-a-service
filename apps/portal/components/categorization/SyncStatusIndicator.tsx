"use client";

import React from "react";
import { CheckCircleIcon, ClockIcon, XCircleIcon } from "@heroicons/react/24/outline";

interface SyncStatusIndicatorProps {
  status: "synced" | "pending" | "failed" | null;
  lastSyncedAt: string | null;
  pendingCount?: number;
  onClick?: () => void;
}

export default function SyncStatusIndicator({
  status,
  lastSyncedAt,
  pendingCount = 0,
  onClick,
}: SyncStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "synced":
        return {
          icon: CheckCircleIcon,
          color: "text-green-600 dark:text-green-400",
          bgColor: "bg-green-100 dark:bg-green-900/30",
          label: "Synced",
        };
      case "pending":
        return {
          icon: ClockIcon,
          color: "text-yellow-600 dark:text-yellow-400",
          bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
          label: "Pending",
        };
      case "failed":
        return {
          icon: XCircleIcon,
          color: "text-red-600 dark:text-red-400",
          bgColor: "bg-red-100 dark:bg-red-900/30",
          label: "Failed",
        };
      default:
        return {
          icon: ClockIcon,
          color: "text-gray-600 dark:text-gray-400",
          bgColor: "bg-gray-100 dark:bg-gray-800",
          label: "Not synced",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const formatLastSynced = (timestamp: string | null) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${config.bgColor} ${onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
    >
      <Icon className={`h-4 w-4 ${config.color}`} />
      <span className={`text-sm font-medium ${config.color}`}>
        {config.label}
      </span>
      {pendingCount > 0 && (
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 font-medium">
          {pendingCount}
        </span>
      )}
      {lastSyncedAt && (
        <span className={`text-xs ${config.color} opacity-75`}>
          {formatLastSynced(lastSyncedAt)}
        </span>
      )}
    </div>
  );
}


