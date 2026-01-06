'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Safely creates a Supabase browser client with error handling for corrupted session data.
 * This utility cleans up any old localStorage data that might conflict with SSR cookie-based sessions.
 * 
 * IMPORTANT: Always use this function instead of calling createBrowserClient directly.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      `Missing Supabase environment variables. ` +
      `NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'SET' : 'MISSING'}, ` +
      `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'SET' : 'MISSING'}. ` +
      `Please check your .env.local file.`
    )
  }

  // Clean up any old localStorage Supabase data that might cause conflicts
  // @supabase/ssr uses cookies, but old versions might have used localStorage
  // This prevents "Cannot create property 'user' on string" errors
  if (typeof window !== 'undefined') {
    try {
      // Clear any Supabase-related localStorage keys that might contain corrupted session data
      const keysToRemove: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key && (key.startsWith('sb-') || key.includes('supabase.auth'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => {
        try {
          window.localStorage.removeItem(key)
        } catch {
          // Ignore errors when removing items
        }
      })
    } catch {
      // Ignore errors during cleanup
    }
  }

  // Create the browser client with SSR cookie support
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

