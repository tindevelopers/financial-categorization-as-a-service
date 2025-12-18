/**
 * MULTI-TENANCY DOMAIN
 * 
 * Central multi-tenancy module for the SaaS platform.
 * Handles tenant isolation, context, routing, and white-labeling.
 * 
 * PUBLIC API - Only import from this file!
 */

// ============================================================================
// TYPES
// ============================================================================
// Database types are re-exported from database domain
export type { Database } from './types';
// Dual-mode types
export type { SystemMode, TenantContext } from './types';

// ============================================================================
// TENANT CONTEXT
// ============================================================================
// React hooks and providers
export {
  TenantProvider,
  useTenant,
} from './context';

// Workspace context (client-side)
export {
  WorkspaceProvider,
  useWorkspace,
} from './workspace-context';

// Organization context (client-side) - for dual-mode support
export {
  OrganizationProvider,
  useOrganization,
} from './organization-context';

// ============================================================================
// TENANT RESOLUTION (Server-side - Import directly from files when needed)
// ============================================================================
// ⚠️ SERVER-ONLY: These are server-side functions - import directly from './resolver' in server-side code:
//   import { resolveContext, getSystemMode, getPlatformTenantId, resolveOrganizationFromRequest } from '@/core/multi-tenancy/resolver';
// 
// These functions use createClient from '@/core/database/server' and should only be used in:
// - Server Components
// - Server Actions
// - API Routes
// - Middleware
// Note: Not exported from index to prevent client bundling

// ============================================================================
// TENANT VALIDATION (Server-side - Import directly from files when needed)
// ============================================================================
// These are server-side functions - import directly from validation.ts when needed

// ============================================================================
// SUBDOMAIN ROUTING (Client-safe utilities - Import directly when needed)
// ============================================================================
// These are imported directly in middleware and server-side code

// ============================================================================
// DATABASE QUERIES (Tenant-Aware - Import directly when needed)
// ============================================================================
// These are utility functions - import directly from query-builder.ts when needed

// ============================================================================
// SERVER UTILITIES (Server-side)
// ============================================================================
// ⚠️ SERVER-ONLY: Import directly from './server' in server-side code:
//   import { getCurrentTenant, getCurrentTenantDetails, validateTenantAccess } from '@/core/multi-tenancy/server';
// 
// These functions use createClient from '@/core/database/server' and should only be used in:
// - Server Components
// - Server Actions
// - API Routes
// - Middleware
// Note: Not exported from index to prevent client bundling

// ============================================================================
// ACTIONS (Server Actions - Import directly when needed)
// ============================================================================
// These are server actions - import directly from actions.ts when needed

// ============================================================================
// TENANT ROLES (Server Actions - Import directly when needed)
// ============================================================================
// These are server actions - import directly from tenant-roles.ts when needed

// ============================================================================
// WORKSPACES (Server Actions - Import directly when needed)
// ============================================================================
// These are server actions - import directly from workspaces.ts when needed

// ============================================================================
// WHITE-LABEL SETTINGS
// ============================================================================
// ⚠️ SERVER-ONLY: These are server actions - import directly from './white-label' in server-side code:
//   import { getBrandingSettings, saveBrandingSettings, getThemeSettings, saveThemeSettings, getEmailSettings, saveEmailSettings, getCustomCSS, saveCustomCSS, getCustomDomains, saveCustomDomains } from '@/core/multi-tenancy/white-label';
// 
// These functions use createClient from '@/core/database/server' and should only be used in:
// - Server Components
// - Server Actions
// - API Routes
// Note: Not exported from index to prevent client bundling

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Check if the application is running in multi-tenant mode
 */
export function isMultiTenantEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MULTI_TENANT_ENABLED === 'true';
}

/**
 * Get the tenant resolution strategy from environment
 */
export function getTenantResolutionStrategy(): 'subdomain' | 'header' | 'path' | 'query' {
  return (process.env.NEXT_PUBLIC_TENANT_RESOLUTION as any) || 'subdomain';
}

/**
 * Check if a domain is a valid tenant subdomain
 */
export function isValidTenantDomain(domain: string): boolean {
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
  if (!baseDomain) return false;
  
  return domain.endsWith(`.${baseDomain}`) && domain !== baseDomain;
}


