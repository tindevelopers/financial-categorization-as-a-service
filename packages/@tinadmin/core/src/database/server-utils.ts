import "server-only";

/**
 * SERVER-ONLY DATABASE UTILITIES
 * 
 * These utilities use server-side code and should NEVER be imported
 * in client components. Import from this file only in:
 * - Server Components
 * - Server Actions
 * - API Routes
 * - Middleware
 */

import { createClient } from './server';

/**
 * Health check for database connection
 * Server-only utility - uses createClient() which requires next/headers
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  try {
    const start = Date.now();
    const client = await createClient();
    
    // Simple query to test connection
    const { error } = await client.from('roles').select('id').limit(1);
    
    if (error) {
      return { healthy: false, error: error.message };
    }
    
    const latency = Date.now() - start;
    return { healthy: true, latency };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}


