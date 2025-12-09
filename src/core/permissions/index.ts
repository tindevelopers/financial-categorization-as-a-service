/**
 * PERMISSIONS DOMAIN
 * 
 * Central permissions and RBAC (Role-Based Access Control) module.
 * Handles user permissions, role checks, and access control.
 * 
 * PUBLIC API - Only import from this file!
 */

// ============================================================================
// TYPES
// ============================================================================
export type {
  Permission,
  UserPermissions,
} from './permissions';

// ============================================================================
// PERMISSION CHECKING (Server-Side)
// ============================================================================
// ⚠️ SERVER-ONLY: Import directly from './permissions' in server-side code:
//   import { getUserPermissions, hasPermission, hasAnyPermission, hasAllPermissions } from '@/core/permissions/permissions';
// 
// These functions use createAdminClient and should only be used in:
// - Server Components
// - Server Actions
// - API Routes
// - Middleware
// Note: Not exported from index to prevent client bundling

// ============================================================================
// PERMISSION CHECKING (Client-Side)
// ============================================================================
export {
  getUserPermissionsClient,
  hasPermissionClient,
  hasAnyPermissionClient,
  hasAllPermissionsClient,
} from './permissions-client';

// ============================================================================
// REACT COMPONENTS (Permission Gates)
// ============================================================================
export {
  PermissionGate,
  RequirePermission,
  RequireAnyPermission,
  RequireAllPermissions,
} from './gates';

// ============================================================================
// MIDDLEWARE (Server-Side Permission Checks)
// ============================================================================
// ⚠️ SERVER-ONLY: Import directly from './middleware' in server-side code:
//   import { checkPermission, checkAnyPermission, checkAllPermissions, requirePermission, requireAnyPermission, requireAllPermissions } from '@/core/permissions/middleware';
// 
// These functions use createClient and should only be used in:
// - Server Components
// - Server Actions
// - API Routes
// - Middleware
// Note: Not exported from index to prevent client bundling

// ============================================================================
// TENANT PERMISSIONS
// ============================================================================
// ⚠️ SERVER-ONLY: Import directly from './tenant-permissions' in server-side code:
//   import { getTenantPermissions, hasTenantPermission, getWorkspacePermissions, getPermissionSource, applyPermissionInheritance } from '@/core/permissions/tenant-permissions';
// 
// These functions use createAdminClient and should only be used in:
// - Server Components
// - Server Actions
// - API Routes
// - Middleware
// Note: Not exported from index to prevent client bundling

// ============================================================================
// ACTIONS (Server Actions)
// ============================================================================
export {
  getCurrentUserPermissions,
  getCurrentUserTenantPermissions,
  checkCurrentUserPermission,
  checkCurrentUserTenantPermission,
  getCurrentUserPermissionSource,
} from './actions';

// ============================================================================
// PERMISSION DEFINITIONS
// ============================================================================

/**
 * All available permissions in the system
 */
export const PERMISSIONS = {
  // USER MANAGEMENT
  'users.read': 'View users',
  'users.write': 'Create and edit users',
  'users.delete': 'Delete users',
  
  // TENANT MANAGEMENT
  'tenants.read': 'View tenants',
  'tenants.write': 'Create and edit tenants',
  'tenants.delete': 'Delete tenants',
  
  // ROLE MANAGEMENT
  'roles.read': 'View roles',
  'roles.write': 'Create and edit roles',
  'roles.delete': 'Delete roles',
  
  // BILLING
  'billing.read': 'View billing information',
  'billing.write': 'Manage billing and subscriptions',
  
  // ANALYTICS
  'analytics.read': 'View analytics',
  'analytics.export': 'Export analytics data',
  
  // SETTINGS
  'settings.read': 'View settings',
  'settings.write': 'Update settings',
  
  // WHITE LABEL
  'whitelabel.read': 'View white-label settings',
  'whitelabel.write': 'Update white-label settings',
  
  // INTEGRATIONS
  'integrations.read': 'View integrations',
  'integrations.write': 'Manage integrations',
  
  // WEBHOOKS
  'webhooks.read': 'View webhooks',
  'webhooks.write': 'Manage webhooks',
  
  // AUDIT LOGS
  'audit.read': 'View audit logs',
  
  // SUPPORT
  'support.read': 'View support tickets',
  'support.write': 'Manage support tickets',
} as const;

/**
 * Permission categories for organization
 */
export const PERMISSION_CATEGORIES = {
  ADMIN: ['users.*', 'tenants.*', 'roles.*'],
  BILLING: ['billing.*'],
  ANALYTICS: ['analytics.*'],
  SETTINGS: ['settings.*', 'whitelabel.*'],
  INTEGRATIONS: ['integrations.*', 'webhooks.*'],
  SUPPORT: ['support.*'],
} as const;

/**
 * Role-based permission presets
 */
export const ROLE_PERMISSIONS = {
  'Platform Admin': Object.keys(PERMISSIONS), // All permissions
  'Organization Admin': [
    'users.read', 'users.write',
    'tenants.read',
    'roles.read',
    'billing.read', 'billing.write',
    'analytics.read', 'analytics.export',
    'settings.read', 'settings.write',
    'whitelabel.read', 'whitelabel.write',
    'integrations.read', 'integrations.write',
    'support.read', 'support.write',
  ],
  'User': [
    'users.read',
    'billing.read',
    'analytics.read',
    'settings.read',
    'support.read', 'support.write',
  ],
  'Guest': [
    'settings.read',
  ],
} as const;

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Check if a permission string matches a pattern
 * Supports wildcards: 'users.*' matches 'users.read', 'users.write', etc.
 */
export function matchesPermission(permission: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern === permission) return true;
  
  const regex = new RegExp(`^${pattern.replace('*', '.*')}$`);
  return regex.test(permission);
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(roleName: string): string[] {
  const perms = ROLE_PERMISSIONS[roleName as keyof typeof ROLE_PERMISSIONS];
  return perms ? [...perms] : [];
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(roleName: string, permission: string): boolean {
  const rolePerms = getPermissionsForRole(roleName);
  return rolePerms.some(p => matchesPermission(permission, p));
}

/**
 * Get permission category for a permission
 */
export function getPermissionCategory(permission: string): string | null {
  for (const [category, patterns] of Object.entries(PERMISSION_CATEGORIES)) {
    if (patterns.some(pattern => matchesPermission(permission, pattern))) {
      return category;
    }
  }
  return null;
}

/**
 * Get all permissions in a category
 */
export function getPermissionsInCategory(category: keyof typeof PERMISSION_CATEGORIES): string[] {
  const patterns = PERMISSION_CATEGORIES[category];
  return Object.keys(PERMISSIONS).filter(permission =>
    patterns.some(pattern => matchesPermission(permission, pattern))
  );
}


