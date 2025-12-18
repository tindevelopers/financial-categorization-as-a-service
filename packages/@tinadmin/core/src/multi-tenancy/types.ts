// Database types should be imported directly from @/core/database
// import type { Database } from "@/core/database";

/**
 * System mode for multi-tenancy
 * - 'multi-tenant': Standard tenant isolation (tenant → organizations)
 * - 'organization-only': Single tenant managing multiple organizations
 */
export type SystemMode = 'multi-tenant' | 'organization-only';

/**
 * Tenant context with dual-mode support
 */
export interface TenantContext {
  tenantId: string | null;
  organizationId: string | null;
  mode: SystemMode;
  effectiveScope: 'tenant' | 'organization';
}

