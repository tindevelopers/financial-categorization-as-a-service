'use client'

import { useState, useEffect } from 'react'
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

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    try {
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
      await supabase.auth.signOut()
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

