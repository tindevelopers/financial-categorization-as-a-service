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
// PERMISSION DEFINITIONS & UTILITIES
// ============================================================================
// Re-export from utils to avoid server-only imports in tests
export {
  PERMISSIONS,
  PERMISSION_CATEGORIES,
  ROLE_PERMISSIONS,
  matchesPermission,
  getPermissionsForRole,
  roleHasPermission,
  getPermissionCategory,
  getPermissionsInCategory,
} from './utils';


