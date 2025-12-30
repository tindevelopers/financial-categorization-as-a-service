/**
 * Global admin role helpers
 *
 * These roles represent "system-wide" admin users who should use the full admin console
 * (separate deployment), not the consumer portal.
 */

export const GLOBAL_ADMIN_ROLES = [
  "Platform Admin",
  "System Admin",
  "Super Admin",
] as const;

export type GlobalAdminRole = (typeof GLOBAL_ADMIN_ROLES)[number];

export function isGlobalAdminRole(roleName: string | null | undefined): roleName is GlobalAdminRole {
  if (!roleName) return false;
  return (GLOBAL_ADMIN_ROLES as readonly string[]).includes(roleName);
}


