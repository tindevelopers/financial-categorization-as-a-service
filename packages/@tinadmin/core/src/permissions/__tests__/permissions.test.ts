import { describe, expect, it } from 'vitest';
// Import utility functions directly to avoid server-only imports
import {
  matchesPermission,
  getPermissionsForRole,
  roleHasPermission,
} from '@/core/permissions/utils';

describe('permissions core', () => {
  it('matchesPermission supports wildcards', () => {
    expect(matchesPermission('users.read', 'users.*')).toBe(true);
    expect(matchesPermission('users.read', '*')).toBe(true);
    expect(matchesPermission('users.read', 'users.read')).toBe(true);
    expect(matchesPermission('users.read', 'billing.*')).toBe(false);
  });

  it('returns permissions for known role', () => {
    const perms = getPermissionsForRole('Organization Admin');
    expect(perms).toContain('users.read');
    expect(perms.length).toBeGreaterThan(3);
  });

  it('checks role permissions correctly', () => {
    expect(roleHasPermission('Platform Admin', 'billing.write')).toBe(true);
    expect(roleHasPermission('Organization Admin', 'users.write')).toBe(true);
    expect(roleHasPermission('Organization Admin', 'tenants.delete')).toBe(false);
  });
});
