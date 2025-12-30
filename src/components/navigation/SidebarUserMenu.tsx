'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import {
  ArrowRightStartOnRectangleIcon,
  UserCircleIcon,
  ChevronUpIcon,
  CreditCardIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { useSubscriptionOptional } from '@/context/SubscriptionContext'
import { getPlanDisplayInfo, shouldShowUpgrade } from '@/config/plans'

export function SidebarUserMenu() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef<any>(null)
  
  // Get subscription context (optional - won't throw if not in provider)
  const subscriptionContext = useSubscriptionOptional()

  // Create Supabase client lazily
  const getSupabase = () => {
    if (!supabaseRef.current && typeof window !== 'undefined') {
      supabaseRef.current = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    }
    return supabaseRef.current
  }

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    // Close menu when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadUser = async () => {
    try {
      const supabase = getSupabase()
      if (!supabase) {
        setLoading(false)
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    } catch (error) {
      console.error('Failed to load user:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      const supabase = getSupabase()
      if (supabase) {
        await supabase.auth.signOut()
      }
      router.push('/signin')
      router.refresh()
    } catch (error) {
      console.error('Sign out error:', error)
      router.push('/signin')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2 px-2 py-2">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const userEmail = user.email || 'User'
  const userInitials = userEmail
    .split('@')[0]
    .substring(0, 2)
    .toUpperCase()

  // Plan information
  const planName = subscriptionContext?.planName
  const status = subscriptionContext?.status
  const isTrialing = subscriptionContext?.isTrialing
  const planDisplayInfo = getPlanDisplayInfo(planName)
  const showUpgrade = shouldShowUpgrade(planName)

  return (
    <div className="relative" ref={menuRef}>
      {/* Dropdown Menu - positioned above the button */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <div className="p-2">
            <button
              onClick={() => {
                router.push('/dashboard/profile')
                setIsOpen(false)
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <UserCircleIcon className="h-5 w-5" />
              Profile
            </button>
            <button
              onClick={() => {
                router.push('/saas/billing/dashboard')
                setIsOpen(false)
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <CreditCardIcon className="h-5 w-5" />
              Billing
            </button>
            {showUpgrade && (
              <button
                onClick={() => {
                  router.push('/saas/billing/plans')
                  setIsOpen(false)
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
              >
                <SparklesIcon className="h-5 w-5" />
                Upgrade Plan
              </button>
            )}
            <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Plan Badge */}
      {subscriptionContext && !subscriptionContext.isLoading && (
        <div className="mb-2 px-1">
          <Link
            href="/saas/billing/dashboard"
            className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
              planDisplayInfo
                ? `${planDisplayInfo.bgColor} hover:opacity-80`
                : 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
            }`}
          >
            <SparklesIcon className={`h-4 w-4 ${planDisplayInfo?.color || 'text-amber-600 dark:text-amber-400'}`} />
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-medium ${planDisplayInfo?.color || 'text-amber-700 dark:text-amber-300'}`}>
                {planName ? (
                  <>
                    {planName}
                    {isTrialing && ' Trial'}
                  </>
                ) : (
                  'No Plan'
                )}
              </div>
              {planName && status && (
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  {status === 'active' ? 'Active' : status === 'trialing' ? 'Trial Period' : status}
                </div>
              )}
            </div>
            {showUpgrade && (
              <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                Upgrade
              </span>
            )}
          </Link>
        </div>
      )}

      {/* User Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-sm font-medium text-white dark:bg-zinc-600">
          {userInitials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-medium text-zinc-900 dark:text-white">
            {userEmail.split('@')[0]}
          </div>
          <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {userEmail}
          </div>
        </div>
        <ChevronUpIcon 
          className={`h-4 w-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
    </div>
  )
}
