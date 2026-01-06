'use client'

import { useEffect } from 'react'

/**
 * Component that cleans up corrupted Supabase session data on mount.
 * This prevents "Cannot create property 'user' on string" errors.
 * Should be included in the root layout.
 */
export function SessionCleanup() {
  useEffect(() => {
    // Clean up any old localStorage Supabase data that might cause conflicts
    // @supabase/ssr uses cookies, but old versions might have used localStorage
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key && (key.startsWith('sb-') || key.includes('supabase.auth'))) {
          keysToRemove.push(key)
        }
      }
      if (keysToRemove.length > 0) {
        keysToRemove.forEach(key => {
          try {
            window.localStorage.removeItem(key)
          } catch {
            // Ignore errors when removing items
          }
        })
      }
    } catch {
      // Ignore errors during cleanup
    }
  }, [])

  return null
}

