"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSubscriptionType, type SubscriptionType } from "@/app/actions/subscription";

export function SubscriptionBadge() {
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscriptionType();
  }, []);

  const loadSubscriptionType = async () => {
    try {
      const result = await getSubscriptionType();
      if (result.success) {
        setSubscriptionType(result.subscriptionType || null);
      }
    } catch (error) {
      console.error("Failed to load subscription type:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !subscriptionType) {
    return null;
  }

  const badgeColors = {
    individual: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
    company: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
    enterprise: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
  };

  return (
    <Link
      href="/saas/settings/subscription"
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors hover:opacity-80 ${badgeColors[subscriptionType]}`}
    >
      {subscriptionType.charAt(0).toUpperCase() + subscriptionType.slice(1)}
    </Link>
  );
}

