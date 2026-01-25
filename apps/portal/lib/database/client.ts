'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Safely creates a Supabase browser client with error handling for corrupted session data.
 * This utility cleans up any old localStorage data that might conflict with SSR cookie-based sessions.
 * 
 * IMPORTANT: Always use this function instead of calling createBrowserClient directly.
 */
export function createClient() {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'fetch-debug',hypothesisId:'H1',location:'apps/portal/lib/database/client.ts:createClient',message:'createClient entry',data:{hasSupabaseUrl:!!process.env.NEXT_PUBLIC_SUPABASE_URL,hasAnonKey:!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,urlLength:process.env.NEXT_PUBLIC_SUPABASE_URL?.length||0,keyLength:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length||0,urlPreview:process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0,50)||'MISSING'},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'fetch-debug',hypothesisId:'H1',location:'apps/portal/lib/database/client.ts:createClient',message:'env vars after trim',data:{hasSupabaseUrl:!!supabaseUrl,hasAnonKey:!!supabaseAnonKey,urlIsValid:supabaseUrl?.startsWith('http'),keyPrefix:supabaseAnonKey?.substring(0,20)||'MISSING'},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (!supabaseUrl || !supabaseAnonKey) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'fetch-debug',hypothesisId:'H1',location:'apps/portal/lib/database/client.ts:createClient',message:'missing env vars error',data:{missingUrl:!supabaseUrl,missingKey:!supabaseAnonKey},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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

      // Clear localhost Supabase cookies if using remote Supabase
      // Cookies are named like: sb-{projectRef}-auth-token
      // Localhost cookies: sb-127-auth-token, sb-localhost-auth-token
      const isRemoteSupabase = supabaseUrl && !supabaseUrl.includes('127.0.0.1') && !supabaseUrl.includes('localhost')
      if (isRemoteSupabase) {
        // Clear cookies that reference localhost
        const cookiesToClear = ['sb-127-auth-token', 'sb-localhost-auth-token']
        cookiesToClear.forEach(cookieName => {
          try {
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=localhost`
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=127.0.0.1`
          } catch {
            // Ignore cookie clearing errors
          }
        })
      }
    } catch {
      // Ignore errors during cleanup
    }
  }

  // Create the browser client with SSR cookie support
  try {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'fetch-debug',hypothesisId:'H1',location:'apps/portal/lib/database/client.ts:createClient',message:'before createBrowserClient',data:{url:supabaseUrl.substring(0,60)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const client = createBrowserClient(supabaseUrl, supabaseAnonKey);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'fetch-debug',hypothesisId:'H1',location:'apps/portal/lib/database/client.ts:createClient',message:'createBrowserClient success',data:{hasClient:!!client},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return client;
  } catch (err: any) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'fetch-debug',hypothesisId:'H1',location:'apps/portal/lib/database/client.ts:createClient',message:'createBrowserClient error',data:{error:err?.message||String(err),errorType:err?.constructor?.name},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw err;
  }
}

