import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    const urlStatus = supabaseUrl ? 'SET' : 'MISSING';
    const keyStatus = supabaseAnonKey ? 'SET' : 'MISSING';
    
    throw new Error(
      `Missing Supabase environment variables. ` +
      `NEXT_PUBLIC_SUPABASE_URL: ${urlStatus}, ` +
      `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${keyStatus}. ` +
      `Please check your .env.local file and restart the dev server. ` +
      `If using a monorepo, ensure environment variables are properly configured.`
    );
  }

  try {
    return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  } catch (error) {
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

