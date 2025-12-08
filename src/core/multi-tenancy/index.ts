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
export type {
  TenantContext,
  TenantResolutionSource,
  TenantValidationResult,
} from './types';

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

// ============================================================================
// TENANT RESOLUTION (Server-side - Import directly from files when needed)
// ============================================================================
// These are server-side functions - import directly from resolver.ts when needed

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
export {
  getCurrentTenant,
  getCurrentTenantDetails,
  validateTenantAccess,
} from './server';

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
export {
  getBrandingSettings,
  saveBrandingSettings,
  getThemeSettings,
  saveThemeSettings,
  getEmailSettings,
  saveEmailSettings,
  getCustomCSS,
  saveCustomCSS,
  getCustomDomains,
  saveCustomDomains,
} from './white-label';

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


