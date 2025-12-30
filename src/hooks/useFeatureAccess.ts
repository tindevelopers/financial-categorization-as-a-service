'use client'

import { useSubscription, useSubscriptionOptional } from '@/context/SubscriptionContext'
import {
  getPlanFeatures,
  planHasFeature,
  planCanUseIntegration,
  getPlanTier,
  shouldShowUpgrade,
  type PlanFeatures,
} from '@/config/plans'

/**
 * Hook for checking feature access based on the user's current subscription plan.
 * Throws an error if used outside of SubscriptionProvider.
 */
export function useFeatureAccess() {
  const { subscription, planName, isLoading, isActive, isTrialing } = useSubscription()

  const features = getPlanFeatures(planName)
  const hasActivePlan = (isActive || isTrialing) && !!subscription

  return {
    /** Whether subscription data is still loading */
    isLoading,

    /** Whether user has an active or trialing subscription */
    hasActivePlan,

    /** Current plan name */
    planName,

    /** All features for the current plan */
    features,

    /** Plan tier level (0 = none, 1 = Starter, 2 = Professional, 3 = Enterprise) */
    planTier: getPlanTier(planName),

    /** Whether upgrade prompt should be shown */
    shouldShowUpgrade: shouldShowUpgrade(planName),

    /**
     * Check if the current plan has a specific feature
     * @param feature - The feature key to check
     */
    hasFeature: (feature: keyof PlanFeatures): boolean => {
      if (!hasActivePlan) return false
      return planHasFeature(planName, feature)
    },

    /**
     * Check if the current plan can use a specific integration
     * @param integration - The integration type (e.g., 'csv', 'api', 'google-sheets')
     */
    canUseIntegration: (integration: string): boolean => {
      if (!hasActivePlan) return false
      return planCanUseIntegration(planName, integration)
    },

    /**
     * Check if current plan has API access
     */
    hasApiAccess: (): boolean => {
      if (!hasActivePlan) return false
      return features?.apiAccess ?? false
    },

    /**
     * Check if current plan has custom categories
     */
    hasCustomCategories: (): boolean => {
      if (!hasActivePlan) return false
      return features?.customCategories ?? false
    },

    /**
     * Check if current plan has priority support
     */
    hasPrioritySupport: (): boolean => {
      if (!hasActivePlan) return false
      return features?.prioritySupport ?? false
    },

    /**
     * Check if current plan has bulk processing
     */
    hasBulkProcessing: (): boolean => {
      if (!hasActivePlan) return false
      return features?.bulkProcessing ?? false
    },

    /**
     * Check if current plan has advanced analytics
     */
    hasAdvancedAnalytics: (): boolean => {
      if (!hasActivePlan) return false
      return features?.advancedAnalytics ?? false
    },

    /**
     * Get transaction limit for the current plan
     */
    getTransactionLimit: (): number => {
      return features?.transactionsPerMonth ?? 0
    },

    /**
     * Get storage limit in GB for the current plan
     */
    getStorageLimit: (): number => {
      return features?.storageGB ?? 0
    },

    /**
     * Check if user is within transaction limit
     * @param currentCount - Current number of transactions
     */
    isWithinTransactionLimit: (currentCount: number): boolean => {
      if (!hasActivePlan) return false
      const limit = features?.transactionsPerMonth ?? 0
      return limit === Infinity || currentCount < limit
    },

    /**
     * Get remaining transactions for the current plan
     * @param currentCount - Current number of transactions
     */
    getRemainingTransactions: (currentCount: number): number => {
      if (!hasActivePlan) return 0
      const limit = features?.transactionsPerMonth ?? 0
      if (limit === Infinity) return Infinity
      return Math.max(0, limit - currentCount)
    },

    /**
     * Get usage percentage for transactions
     * @param currentCount - Current number of transactions
     */
    getUsagePercentage: (currentCount: number): number => {
      if (!hasActivePlan) return 0
      const limit = features?.transactionsPerMonth ?? 0
      if (limit === Infinity) return 0
      return Math.min((currentCount / limit) * 100, 100)
    },
  }
}

/**
 * Optional version of useFeatureAccess that returns null if not in a SubscriptionProvider.
 * Useful for components that may be used both inside and outside of the provider.
 */
export function useFeatureAccessOptional() {
  const context = useSubscriptionOptional()
  
  if (!context) {
    return null
  }

  const { subscription, planName, isLoading, isActive, isTrialing } = context
  const features = getPlanFeatures(planName)
  const hasActivePlan = (isActive || isTrialing) && !!subscription

  return {
    isLoading,
    hasActivePlan,
    planName,
    features,
    planTier: getPlanTier(planName),
    shouldShowUpgrade: shouldShowUpgrade(planName),
    hasFeature: (feature: keyof PlanFeatures): boolean => {
      if (!hasActivePlan) return false
      return planHasFeature(planName, feature)
    },
    canUseIntegration: (integration: string): boolean => {
      if (!hasActivePlan) return false
      return planCanUseIntegration(planName, integration)
    },
    hasApiAccess: (): boolean => hasActivePlan && (features?.apiAccess ?? false),
    hasCustomCategories: (): boolean => hasActivePlan && (features?.customCategories ?? false),
    hasPrioritySupport: (): boolean => hasActivePlan && (features?.prioritySupport ?? false),
    hasBulkProcessing: (): boolean => hasActivePlan && (features?.bulkProcessing ?? false),
    hasAdvancedAnalytics: (): boolean => hasActivePlan && (features?.advancedAnalytics ?? false),
    getTransactionLimit: (): number => features?.transactionsPerMonth ?? 0,
    getStorageLimit: (): number => features?.storageGB ?? 0,
    isWithinTransactionLimit: (currentCount: number): boolean => {
      if (!hasActivePlan) return false
      const limit = features?.transactionsPerMonth ?? 0
      return limit === Infinity || currentCount < limit
    },
    getRemainingTransactions: (currentCount: number): number => {
      if (!hasActivePlan) return 0
      const limit = features?.transactionsPerMonth ?? 0
      if (limit === Infinity) return Infinity
      return Math.max(0, limit - currentCount)
    },
    getUsagePercentage: (currentCount: number): number => {
      if (!hasActivePlan) return 0
      const limit = features?.transactionsPerMonth ?? 0
      if (limit === Infinity) return 0
      return Math.min((currentCount / limit) * 100, 100)
    },
  }
}

export default useFeatureAccess


