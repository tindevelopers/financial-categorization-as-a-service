'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
  DropdownLabel,
  DropdownDivider,
  Avatar,
} from '@/components/catalyst'
import {
  UserCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'
import { createBrowserClient } from '@supabase/ssr'

export function UserMenu() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseRef = useRef<any>(null)

  // Create Supabase client lazily to avoid issues during SSR/static generation
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

  const loadUser = async () => {
    try {
      const supabase = getSupabase()
      if (!supabase) {
        setLoading(false)
        return
      }
      const {
        data: { user },
      } = await supabase.auth.getUser()
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
    }
  }

  if (loading) {
    return (
      <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
    )
  }

  if (!user) {
    return null
  }

  const userInitials = user.email
    ? user.email
        .split('@')[0]
        .substring(0, 2)
        .toUpperCase()
    : 'U'

  return (
    <Dropdown>
      <DropdownButton plain>
        <Avatar
          initials={userInitials}
          className="size-8"
          square
          alt={user.email || 'User'}
        />
      </DropdownButton>

      <DropdownMenu anchor="bottom end">
        <DropdownLabel>
          <div className="truncate max-w-[200px]">{user.email}</div>
        </DropdownLabel>

        <DropdownDivider />

        <DropdownItem href="/dashboard/profile">
          <UserCircleIcon />
          Profile
        </DropdownItem>

        <DropdownItem href="/dashboard/settings">
          <Cog6ToothIcon />
          Settings
        </DropdownItem>

        <DropdownDivider />

        <DropdownItem onClick={handleSignOut}>
          <ArrowRightOnRectangleIcon />
          Sign Out
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  )
}

