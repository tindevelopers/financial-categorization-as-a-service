/**
 * Centralized plan features configuration
 * This defines what features are available for each plan tier
 */

export interface PlanFeatures {
  transactionsPerMonth: number
  apiAccess: boolean
  customCategories: boolean
  prioritySupport: boolean
  bulkProcessing: boolean
  advancedAnalytics: boolean
  integrations: string[]
  supportLevel: 'email' | 'priority' | '24/7'
  storageGB: number
}

export const PLAN_FEATURES: Record<string, PlanFeatures> = {
  Starter: {
    transactionsPerMonth: 1000,
    apiAccess: false,
    customCategories: false,
    prioritySupport: false,
    bulkProcessing: false,
    advancedAnalytics: false,
    integrations: ['csv', 'xls', 'xlsx'],
    supportLevel: 'email',
    storageGB: 5,
  },
  Professional: {
    transactionsPerMonth: 10000,
    apiAccess: true,
    customCategories: true,
    prioritySupport: true,
    bulkProcessing: true,
    advancedAnalytics: false,
    integrations: ['csv', 'xls', 'xlsx', 'api', 'google-sheets'],
    supportLevel: 'priority',
    storageGB: 25,
  },
  Enterprise: {
    transactionsPerMonth: Infinity,
    apiAccess: true,
    customCategories: true,
    prioritySupport: true,
    bulkProcessing: true,
    advancedAnalytics: true,
    integrations: ['csv', 'xls', 'xlsx', 'api', 'google-sheets', 'airtable', 'custom'],
    supportLevel: '24/7',
    storageGB: 100,
  },
}

/**
 * Plan display information for UI rendering
 */
export interface PlanDisplayInfo {
  name: string
  description: string
  color: string
  bgColor: string
  borderColor: string
  badgeClass: string
  features: string[]
}

export const PLAN_DISPLAY_INFO: Record<string, PlanDisplayInfo> = {
  Starter: {
    name: 'Starter',
    description: 'Perfect for individuals and small businesses',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    features: [
      'Up to 1,000 transactions/month',
      'CSV, XLS, XLSX support',
      'Automatic categorization',
      'Basic export options',
      'Email support',
    ],
  },
  Professional: {
    name: 'Professional',
    description: 'Ideal for growing businesses',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    features: [
      'Up to 10,000 transactions/month',
      'All file formats supported',
      'Advanced AI categorization',
      'Custom categories',
      'Priority support',
      'API access',
      'Bulk processing',
      'Google Sheets integration',
    ],
  },
  Enterprise: {
    name: 'Enterprise',
    description: 'For large organizations',
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    features: [
      'Unlimited transactions',
      'Dedicated account manager',
      'Custom integrations',
      'Advanced analytics',
      '24/7 support',
      'SLA guarantee',
      'Airtable integration',
      'On-premise deployment option',
    ],
  },
}

/**
 * Get plan features for a given plan name
 */
export function getPlanFeatures(planName: string | null | undefined): PlanFeatures | null {
  if (!planName) return null
  
  // Normalize plan name (handle variations like "Starter Plan", "starter", etc.)
  const normalizedName = planName.trim()
  
  // Try exact match first
  if (PLAN_FEATURES[normalizedName]) {
    return PLAN_FEATURES[normalizedName]
  }
  
  // Try case-insensitive match
  const lowerName = normalizedName.toLowerCase()
  for (const [key, features] of Object.entries(PLAN_FEATURES)) {
    if (key.toLowerCase() === lowerName || lowerName.includes(key.toLowerCase())) {
      return features
    }
  }
  
  return null
}

/**
 * Get plan display info for a given plan name
 */
export function getPlanDisplayInfo(planName: string | null | undefined): PlanDisplayInfo | null {
  if (!planName) return null
  
  const normalizedName = planName.trim()
  
  if (PLAN_DISPLAY_INFO[normalizedName]) {
    return PLAN_DISPLAY_INFO[normalizedName]
  }
  
  const lowerName = normalizedName.toLowerCase()
  for (const [key, info] of Object.entries(PLAN_DISPLAY_INFO)) {
    if (key.toLowerCase() === lowerName || lowerName.includes(key.toLowerCase())) {
      return info
    }
  }
  
  return null
}

/**
 * Check if a plan has a specific feature
 */
export function planHasFeature(
  planName: string | null | undefined,
  feature: keyof PlanFeatures
): boolean {
  const features = getPlanFeatures(planName)
  if (!features) return false
  
  const value = features[feature]
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value)
}

/**
 * Check if a plan can use a specific integration
 */
export function planCanUseIntegration(
  planName: string | null | undefined,
  integration: string
): boolean {
  const features = getPlanFeatures(planName)
  if (!features) return false
  return features.integrations.includes(integration)
}

/**
 * Get the tier level of a plan (for comparison)
 */
export function getPlanTier(planName: string | null | undefined): number {
  if (!planName) return 0
  const lowerName = planName.toLowerCase()
  
  if (lowerName.includes('enterprise')) return 3
  if (lowerName.includes('professional') || lowerName.includes('pro')) return 2
  if (lowerName.includes('starter')) return 1
  
  return 0
}

/**
 * Check if user should see upgrade prompt (not on highest tier)
 */
export function shouldShowUpgrade(planName: string | null | undefined): boolean {
  return getPlanTier(planName) < 3
}


