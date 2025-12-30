'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { getActiveSubscription } from '@/app/actions/stripe/subscriptions'

export interface Subscription {
  id: string
  tenant_id: string
  stripe_customer_id: string
  stripe_subscription_id: string
  stripe_price_id: string
  stripe_product_id: string
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing' | 'incomplete' | 'incomplete_expired' | 'paused'
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  canceled_at: string | null
  trial_start: string | null
  trial_end: string | null
  plan_name: string
  plan_price: number
  billing_cycle: 'monthly' | 'annual'
  currency: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface SubscriptionContextType {
  subscription: Subscription | null
  isLoading: boolean
  error: string | null
  planName: string | null
  status: Subscription['status'] | null
  isActive: boolean
  isTrialing: boolean
  refreshSubscription: () => Promise<void>
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined)

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSubscription = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const result = await getActiveSubscription()

      if (result.success) {
        setSubscription(result.subscription || null)
      } else {
        setError(result.error || 'Failed to load subscription')
        setSubscription(null)
      }
    } catch (err) {
      console.error('Error loading subscription:', err)
      setError(err instanceof Error ? err.message : 'Failed to load subscription')
      setSubscription(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSubscription()

    // Listen for auth changes and reload subscription
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(() => {
      loadSubscription()
    })

    return () => {
      authSubscription.unsubscribe()
    }
  }, [])

  const refreshSubscription = async () => {
    await loadSubscription()
  }

  const planName = subscription?.plan_name || null
  const status = subscription?.status || null
  const isActive = status === 'active'
  const isTrialing = status === 'trialing'

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        isLoading,
        error,
        planName,
        status,
        isActive,
        isTrialing,
        refreshSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const context = useContext(SubscriptionContext)
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider')
  }
  return context
}

/**
 * Hook that returns subscription context if available, or null if not wrapped in provider.
 * Useful for components that may be used both inside and outside of SubscriptionProvider.
 */
export function useSubscriptionOptional() {
  const context = useContext(SubscriptionContext)
  return context ?? null
}


