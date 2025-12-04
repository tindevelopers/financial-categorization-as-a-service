/**
 * Tenant-Aware Query Builder
 * 
 * Provides utilities for building tenant-scoped queries
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ensureTenantId, hasTenantAccess } from "./validation";

type TableName = keyof Database["public"]["Tables"];

export interface TenantQueryOptions {
  tenantId?: string | null;
  includePlatformAdmins?: boolean;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
}

/**
 * Build a tenant-scoped query
 * Automatically filters by tenant_id unless user is Platform Admin
 * Note: For server-side usage, check Platform Admin status separately
 */
export async function buildTenantQuery<T extends TableName>(
  supabase: SupabaseClient<Database>,
  table: T,
  options: TenantQueryOptions = {}
): Promise<ReturnType<SupabaseClient<Database>["from"]>> {
  let query = supabase.from(table);

  // Filter by tenant_id if provided, otherwise get from context
  // Note: Platform Admin check should be done at the server action level
  // If includePlatformAdmins is true, Platform Admin can see all (no filter)
  if (options.includePlatformAdmins) {
    // Platform Admin mode - only filter if explicit tenantId provided
    if (options.tenantId) {
      query = query.eq("tenant_id", options.tenantId) as any;
    }
    // Otherwise, no filter (Platform Admin sees all)
  } else {
    // Regular user mode - must filter by tenant_id
    const tenantId = options.tenantId || await ensureTenantId();
    query = query.eq("tenant_id", tenantId) as any;
  }

  // Apply ordering
  if (options.orderBy) {
    query = query.order(options.orderBy.column, {
      ascending: options.orderBy.ascending ?? true,
    }) as any;
  }

  // Apply limit
  if (options.limit) {
    query = query.limit(options.limit) as any;
  }

  // Apply offset
  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1) as any;
  }

  return query;
}

/**
 * Build a query that includes tenant information
 */
export async function buildTenantScopedQuery<T extends TableName>(
  supabase: SupabaseClient<Database>,
  table: T,
  select: string,
  options: TenantQueryOptions = {}
) {
  const query = await buildTenantQuery(supabase, table, options);
  return query.select(select);
}

/**
 * Validate tenant access before executing query
 */
export async function validateAndQuery<T extends TableName>(
  supabase: SupabaseClient<Database>,
  table: T,
  tenantId: string,
  select: string,
  options: Omit<TenantQueryOptions, "tenantId"> = {}
) {
  const hasAccess = await hasTenantAccess(tenantId);
  if (!hasAccess) {
    throw new Error("Access denied: Invalid tenant access");
  }

  return buildTenantScopedQuery(supabase, table, select, {
    ...options,
    tenantId,
  });
}

/**
 * Get tenant ID from various sources (URL param, header, session)
 */
export function extractTenantIdFromRequest(
  url?: string,
  headers?: Headers | Record<string, string>
): string | null {
  // Try URL parameter first
  if (url) {
    const urlObj = new URL(url, "http://localhost");
    const tenantParam = urlObj.searchParams.get("tenant_id");
    if (tenantParam) return tenantParam;
  }

  // Try header
  if (headers) {
    const headerValue =
      headers instanceof Headers
        ? headers.get("x-tenant-id")
        : headers["x-tenant-id"];
    if (headerValue) return headerValue;
  }

  return null;
}

/**
 * Extract tenant from subdomain
 * Example: tenant1.example.com -> tenant1
 */
export function extractTenantFromSubdomain(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(":")[0];

  // Split by dots
  const parts = host.split(".");

  // If we have at least 3 parts (tenant.subdomain.domain), extract tenant
  // Or if we have 2 parts and it's not a standard domain
  if (parts.length >= 3) {
    // tenant.subdomain.domain.com -> tenant
    return parts[0];
  }

  // For localhost or IP addresses, return null
  if (host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null;
  }

  return null;
}

