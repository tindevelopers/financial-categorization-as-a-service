/**
 * DATABASE DOMAIN
 * 
 * Central database module for the SaaS platform.
 * Provides database clients, types, and data access utilities.
 * 
 * PUBLIC API - Only import from this file!
 */

// ============================================================================
// TYPES
// ============================================================================
export type { Database } from './types';

// ============================================================================
// CLIENTS
// ============================================================================

/**
 * Server-side Supabase client (SSR-aware)
 * ⚠️ SERVER-ONLY: Import directly from './server' in server-side code:
 *   import { createClient } from '@/core/database/server';
 * 
 * Use this in:
 * - Server Components
 * - Server Actions
 * - API Routes
 * - Middleware
 */
// Note: Not exported from index to prevent client bundling
// Import directly: import { createClient } from '@/core/database/server';

/**
 * Client-side Supabase client (Browser)
 * Use this in Client Components
 */
export { createClient as createBrowserClient } from './client';

/**
 * Admin Supabase client (Bypasses RLS)
 * ⚠️ SERVER-ONLY: Import directly from './admin-client' in server-side code:
 *   import { createAdminClient } from '@/core/database/admin-client';
 * 
 * Use this ONLY in server-side admin operations:
 * - Server Components
 * - Server Actions
 * - API Routes
 * - Middleware
 * 
 * NEVER expose to the client!
 */
// Note: Not exported from index to prevent client bundling
// Import directly: import { createAdminClient } from '@/core/database/admin-client';

/**
 * Tenant-aware Supabase client
 * Automatically applies tenant context
 */
export {
  createTenantAwareClient,
  createTenantAwareServerClient,
  createTenantAwareAdminClient,
  TenantAwareClient
} from './tenant-client';

// ============================================================================
// USER MANAGEMENT
// ============================================================================
export {
  getAllUsers,
} from './users';

// ============================================================================
// TENANT MANAGEMENT
// ============================================================================
export {
  getTenant,
  getTenants,
  createTenant,
  updateTenant,
  deleteTenant,
} from './tenants';

// ============================================================================
// ROLE MANAGEMENT
// ============================================================================
export {
  getRoleById,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
} from './roles';

// ============================================================================
// WORKSPACE MANAGEMENT
// ============================================================================
export {
  getWorkspace,
  getWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  addUserToWorkspace,
  removeUserFromWorkspace,
  updateWorkspaceUser,
  getUserWorkspaces,
  getWorkspaceMembers,
} from './workspaces';

// ============================================================================
// USER-TENANT ROLES (Multi-Role System)
// ============================================================================
export {
  assignTenantRole,
  removeTenantRole,
  getUserTenantRoles,
  getEffectiveRole,
} from './user-tenant-roles';

// ============================================================================
// ORGANIZATION ADMINS
// ============================================================================
export {
  getAllOrganizationAdmins,
  isPlatformAdmin,
} from './organization-admins';

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get the current database provider type
 */
export function getDatabaseProvider(): 'supabase' | 'postgres' | 'mysql' {
  return (process.env.NEXT_PUBLIC_DATABASE_PROVIDER as any) || 'supabase';
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Get database connection info (for debugging)
 */
export function getDatabaseInfo(): {
  provider: string;
  url: string;
  environment: string;
} {
  return {
    provider: getDatabaseProvider(),
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not configured',
    environment: process.env.NODE_ENV || 'unknown',
  };
}

// ============================================================================
// SERVER-ONLY UTILITIES
// ============================================================================
// Note: checkDatabaseHealth() has been moved to ./server-utils.ts
// Import it directly from there in server-side code only:
// import { checkDatabaseHealth } from '@/core/database/server-utils';


