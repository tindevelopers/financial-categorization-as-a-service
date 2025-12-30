'use client'

import Link from 'next/link'
import { CheckCircleIcon, ExclamationTriangleIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useSubscription, Subscription } from '@/context/SubscriptionContext'
import { getPlanDisplayInfo, getPlanFeatures, shouldShowUpgrade, PLAN_FEATURES } from '@/config/plans'

interface PlanStatusCardProps {
  /** Show compact version without full feature list */
  compact?: boolean
  /** Custom class name */
  className?: string
  /** Show usage stats */
  showUsage?: boolean
  /** Current transaction count (if available) */
  currentTransactions?: number
}

export function PlanStatusCard({
  compact = false,
  className = '',
  showUsage = true,
  currentTransactions,
}: PlanStatusCardProps) {
  const { subscription, isLoading, planName, status, isActive, isTrialing } = useSubscription()

  if (isLoading) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900 animate-pulse ${className}`}>
        <div className="h-6 w-32 bg-gray-200 dark:bg-zinc-700 rounded mb-3" />
        <div className="h-4 w-48 bg-gray-200 dark:bg-zinc-700 rounded mb-2" />
        <div className="h-4 w-24 bg-gray-200 dark:bg-zinc-700 rounded" />
      </div>
    )
  }

  const displayInfo = getPlanDisplayInfo(planName)
  const features = getPlanFeatures(planName)

  // No subscription
  if (!subscription || !planName) {
    return (
      <div className={`rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-900/20 ${className}`}>
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 dark:text-amber-200">
              No Active Plan
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              Subscribe to unlock all features and start categorizing your transactions.
            </p>
            <Link
              href="/saas/billing/plans"
              className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-amber-800 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200"
            >
              View Plans
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const formatCurrency = (amount: number | null | undefined, currency: string = 'usd') => {
    if (amount === null || amount === undefined) return '$0'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100)
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusBadge = (status: Subscription['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Active
          </span>
        )
      case 'trialing':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Trial
          </span>
        )
      case 'past_due':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Past Due
          </span>
        )
      case 'canceled':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            Canceled
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            {status}
          </span>
        )
    }
  }

  // Calculate usage percentage if we have transaction limit
  const transactionLimit = features?.transactionsPerMonth || 0
  const usagePercentage = transactionLimit && currentTransactions 
    ? Math.min((currentTransactions / transactionLimit) * 100, 100) 
    : 0
  const isNearLimit = usagePercentage >= 80
  const isAtLimit = usagePercentage >= 100

  if (compact) {
    return (
      <div className={`rounded-xl border ${displayInfo?.borderColor || 'border-gray-200 dark:border-zinc-700'} ${displayInfo?.bgColor || 'bg-white dark:bg-zinc-900'} p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${displayInfo?.bgColor || 'bg-gray-100 dark:bg-zinc-800'}`}>
              <SparklesIcon className={`h-5 w-5 ${displayInfo?.color || 'text-gray-600 dark:text-gray-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${displayInfo?.color || 'text-gray-900 dark:text-white'}`}>
                  {planName}
                </span>
                {getStatusBadge(status!)}
              </div>
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                {formatCurrency(subscription.plan_price, subscription.currency)}/{subscription.billing_cycle}
              </p>
            </div>
          </div>
          <Link
            href="/saas/billing/dashboard"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Manage
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border ${displayInfo?.borderColor || 'border-gray-200 dark:border-zinc-700'} bg-white dark:bg-zinc-900 overflow-hidden ${className}`}>
      {/* Header */}
      <div className={`px-5 py-4 ${displayInfo?.bgColor || 'bg-gray-50 dark:bg-zinc-800'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-zinc-900 shadow-sm`}>
              <SparklesIcon className={`h-6 w-6 ${displayInfo?.color || 'text-gray-600 dark:text-gray-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-lg font-bold ${displayInfo?.color || 'text-gray-900 dark:text-white'}`}>
                  {planName} Plan
                </h3>
                {getStatusBadge(status!)}
              </div>
              <p className="text-sm text-gray-600 dark:text-zinc-400">
                {formatCurrency(subscription.plan_price, subscription.currency)} per {subscription.billing_cycle === 'annual' ? 'year' : 'month'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        {/* Billing info */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-zinc-400">
            {subscription.cancel_at_period_end ? 'Cancels on' : 'Next billing'}
          </span>
          <span className={`font-medium ${subscription.cancel_at_period_end ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
            {formatDate(subscription.current_period_end)}
          </span>
        </div>

        {/* Trial end date if applicable */}
        {isTrialing && subscription.trial_end && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-zinc-400">Trial ends</span>
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {formatDate(subscription.trial_end)}
            </span>
          </div>
        )}

        {/* Usage progress if available */}
        {showUsage && features && transactionLimit < Infinity && (
          <div className="pt-2">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-500 dark:text-zinc-400">Transactions this month</span>
              <span className={`font-medium ${isAtLimit ? 'text-red-600 dark:text-red-400' : isNearLimit ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                {currentTransactions?.toLocaleString() || 0} / {transactionLimit.toLocaleString()}
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
            {isNearLimit && (
              <p className={`text-xs mt-1.5 ${isAtLimit ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {isAtLimit ? 'Transaction limit reached' : 'Approaching transaction limit'}
              </p>
            )}
          </div>
        )}

        {/* Feature highlights */}
        {displayInfo && (
          <div className="pt-2 border-t border-gray-100 dark:border-zinc-800">
            <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
              Features included:
            </p>
            <ul className="space-y-1.5">
              {displayInfo.features.slice(0, 4).map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-400">
                  <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/saas/billing/dashboard"
            className="flex-1 text-center py-2 px-4 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Manage Billing
          </Link>
          {shouldShowUpgrade(planName) && (
            <Link
              href="/saas/billing/plans"
              className="flex-1 text-center py-2 px-4 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Upgrade Plan
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * A minimal plan badge for use in headers/sidebars
 */
export function PlanBadge({ className = '' }: { className?: string }) {
  const { planName, status, isLoading } = useSubscription()

  if (isLoading) {
    return (
      <div className={`h-5 w-16 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse ${className}`} />
    )
  }

  if (!planName) {
    return (
      <Link
        href="/saas/billing/plans"
        className={`inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors ${className}`}
      >
        No Plan
      </Link>
    )
  }

  const displayInfo = getPlanDisplayInfo(planName)

  return (
    <Link
      href="/saas/billing/dashboard"
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors hover:opacity-80 ${displayInfo?.badgeClass || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'} ${className}`}
    >
      {status === 'trialing' && (
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
      )}
      {planName}
      {status === 'trialing' && ' Trial'}
    </Link>
  )
}

export default PlanStatusCard


