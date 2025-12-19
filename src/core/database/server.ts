import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createClient() {
  // #region agent log
  const fs = require('fs');
  try {
    fs.appendFileSync('/Users/gene/Projects/financial-categorization-as-a-service/.cursor/debug.log', JSON.stringify({location:'server.ts:8',message:'createClient called',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C,D'})+'\n');
  } catch {}
  // #endregion
  
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  // #region agent log
  try {
    fs.appendFileSync('/Users/gene/Projects/financial-categorization-as-a-service/.cursor/debug.log', JSON.stringify({location:'server.ts:16',message:'Environment variables check',data:{urlExists:!!supabaseUrl,urlLength:supabaseUrl?.length,keyExists:!!supabaseAnonKey,keyLength:supabaseAnonKey?.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})+'n');
  } catch {}
  // #endregion

  if (!supabaseUrl || !supabaseAnonKey) {
    const urlStatus = supabaseUrl ? 'SET' : 'MISSING';
    const keyStatus = supabaseAnonKey ? 'SET' : 'MISSING';
    
    // #region agent log
    try {
      fs.appendFileSync('/Users/gene/Projects/financial-categorization-as-a-service/.cursor/debug.log', JSON.stringify({location:'server.ts:27',message:'Missing environment variables',data:{urlStatus,keyStatus},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})+'n');
    } catch {}
    // #endregion
    
    throw new Error(
      `Missing Supabase environment variables. ` +
      `NEXT_PUBLIC_SUPABASE_URL: ${urlStatus}, ` +
      `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${keyStatus}. ` +
      `Please check your .env.local file and restart the dev server. ` +
      `If using a monorepo, ensure environment variables are properly configured.`
    );
  }

  try {
    const client = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              // The `set` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: "", ...options });
            } catch (error) {
              // The `remove` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    
    // #region agent log
    try {
      fs.appendFileSync('/Users/gene/Projects/financial-categorization-as-a-service/.cursor/debug.log', JSON.stringify({location:'server.ts:77',message:'createClient success',data:{clientCreated:!!client},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C,D'})+'n');
    } catch {}
    // #endregion
    
    return client;
  } catch (error) {
    // #region agent log
    try {
      fs.appendFileSync('/Users/gene/Projects/financial-categorization-as-a-service/.cursor/debug.log', JSON.stringify({location:'server.ts:85',message:'createClient error',data:{error:String(error),stack:error instanceof Error?error.stack:undefined},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C,D,E'})+'n');
    } catch {}
    // #endregion
    throw error;
  }
}

