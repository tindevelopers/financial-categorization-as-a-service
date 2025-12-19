import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Creates a Supabase client with service role key
 * This bypasses RLS policies and should only be used server-side
 * NEVER expose the service role key to the client
 * 
 * This function should ONLY be called from server actions or API routes
 */
export function createAdminClient() {
  // #region agent log
  const fs = require('fs');
  try {
    fs.appendFileSync('/Users/gene/Projects/financial-categorization-as-a-service/.cursor/debug.log', JSON.stringify({location:'admin-client.ts:14',message:'createAdminClient called',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C,D'})+'n');
  } catch {}
  // #endregion
  
  // In Next.js, server-side environment variables are available without NEXT_PUBLIC_ prefix
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // #region agent log
  try {
    fs.appendFileSync('/Users/gene/Projects/financial-categorization-as-a-service/.cursor/debug.log', JSON.stringify({location:'admin-client.ts:24',message:'Environment check',data:{hasServiceRole:!!serviceRoleKey,hasUrl:!!process.env.NEXT_PUBLIC_SUPABASE_URL},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})+'n');
  } catch {}
  // #endregion
  
  if (!serviceRoleKey) {
    // #region agent log
    try {
      fs.appendFileSync('/Users/gene/Projects/financial-categorization-as-a-service/.cursor/debug.log', JSON.stringify({location:'admin-client.ts:32',message:'Missing SUPABASE_SERVICE_ROLE_KEY',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})+'n');
    } catch {}
    // #endregion
    
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. " +
      "This is required for admin operations. " +
      "Make sure it's set in your .env.local file."
    );
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }

  try {
    const client = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
        },
      }
    );
    
    // #region agent log
    try {
      fs.appendFileSync('/Users/gene/Projects/financial-categorization-as-a-service/.cursor/debug.log', JSON.stringify({location:'admin-client.ts:72',message:'createAdminClient success',data:{clientCreated:!!client},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C,D'})+'n');
    } catch {}
    // #endregion
    
    return client;
  } catch (error) {
    // #region agent log
    try {
      fs.appendFileSync('/Users/gene/Projects/financial-categorization-as-a-service/.cursor/debug.log', JSON.stringify({location:'admin-client.ts:80',message:'createAdminClient error',data:{error:String(error),stack:error instanceof Error?error.stack:undefined},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C,D,E'})+'n');
    } catch {}
    // #endregion
    throw error;
  }
}

