import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:5',message:'createClient called',data:{hasProcessEnv:typeof process !== 'undefined',hasNextPublicSupabaseUrl:typeof process !== 'undefined' && !!process.env?.NEXT_PUBLIC_SUPABASE_URL,hasNextPublicSupabaseAnonKey:typeof process !== 'undefined' && !!process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:10',message:'Environment variables read',data:{urlLength:supabaseUrl?.length || 0,keyLength:supabaseAnonKey?.length || 0,urlPresent:!!supabaseUrl,keyPresent:!!supabaseAnonKey},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  if (!supabaseUrl || !supabaseAnonKey) {
    const urlStatus = supabaseUrl ? 'SET' : 'MISSING';
    const keyStatus = supabaseAnonKey ? 'SET' : 'MISSING';
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:18',message:'Missing environment variables',data:{urlStatus,keyStatus},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
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
    const client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:36',message:'Supabase client created successfully',data:{clientCreated:!!client},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return client;
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:42',message:'createBrowserClient error',data:{errorMessage:error instanceof Error ? error.message : 'unknown',errorType:error?.constructor?.name || 'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    // If createBrowserClient throws an error, provide more context
    if (error instanceof Error && error.message.includes('URL and API key')) {
      throw new Error(
        `Failed to create Supabase client: Environment variables may be empty or invalid. ` +
        `NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'present' : 'missing'}, ` +
        `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'present' : 'missing'}. ` +
        `Please verify your .env.local file contains valid values and restart your dev server.`
      );
    }
    throw error;
  }
}

