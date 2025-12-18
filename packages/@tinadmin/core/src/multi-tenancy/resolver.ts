/**
 * Tenant Resolution Utilities
 * 
 * Resolves tenant from various sources: subdomain, URL params, session, headers
 */

import { createClient as createServerClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import type { Database } from "@/core/database";
import { extractTenantFromSubdomain, extractTenantIdFromRequest } from "./query-builder";
import type { SystemMode, TenantContext } from "./types";

type Tenant = Database["public"]["Tables"]["tenants"]["Row"];
type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];

export interface TenantResolutionResult {
  tenant: Tenant | null;
  tenantId: string | null;
  source: "subdomain" | "url-param" | "header" | "session" | "none";
}

/**
 * Resolve tenant from subdomain
 */
export async function resolveTenantFromSubdomain(
  hostname: string
): Promise<TenantResolutionResult> {
  const subdomain = extractTenantFromSubdomain(hostname);

  if (!subdomain) {
    return {
      tenant: null,
      tenantId: null,
      source: "none",
    };
  }

  try {
    const adminClient = createAdminClient();
    const tenantResult: { data: Tenant | null; error: any } = await adminClient
      .from("tenants")
      .select("*")
      .eq("domain", subdomain)
      .single();

    const tenant = tenantResult.data;
    if (tenantResult.error || !tenant) {
      return {
        tenant: null,
        tenantId: null,
        source: "subdomain",
      };
    }

    return {
      tenant,
      tenantId: tenant.id,
      source: "subdomain",
    };
  } catch {
    return {
      tenant: null,
      tenantId: null,
      source: "subdomain",
    };
  }
}

/**
 * Resolve tenant from URL parameter
 */
export async function resolveTenantFromUrl(
  url: string
): Promise<TenantResolutionResult> {
  const tenantId = extractTenantIdFromRequest(url);

  if (!tenantId) {
    return {
      tenant: null,
      tenantId: null,
      source: "none",
    };
  }

  try {
    const adminClient = createAdminClient();
    const tenantResult2: { data: Tenant | null; error: any } = await adminClient
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .single();

    const tenant = tenantResult2.data;
    if (tenantResult2.error || !tenant) {
      return {
        tenant: null,
        tenantId: null,
        source: "url-param",
      };
    }

    return {
      tenant,
      tenantId: tenant.id,
      source: "url-param",
    };
  } catch {
    return {
      tenant: null,
      tenantId: null,
      source: "url-param",
    };
  }
}

/**
 * Resolve tenant from request headers
 */
export async function resolveTenantFromHeaders(
  headers: Headers | Record<string, string>
): Promise<TenantResolutionResult> {
  const tenantId = extractTenantIdFromRequest(undefined, headers);

  if (!tenantId) {
    return {
      tenant: null,
      tenantId: null,
      source: "none",
    };
  }

  try {
    const adminClient = createAdminClient();
    const tenantResult3: { data: Tenant | null; error: any } = await adminClient
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .single();

    const tenant = tenantResult3.data;
    if (tenantResult3.error || !tenant) {
      return {
        tenant: null,
        tenantId: null,
        source: "header",
      };
    }

    return {
      tenant,
      tenantId: tenant.id,
      source: "header",
    };
  } catch {
    return {
      tenant: null,
      tenantId: null,
      source: "header",
    };
  }
}

/**
 * Resolve tenant from user session
 */
export async function resolveTenantFromSession(): Promise<TenantResolutionResult> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        tenant: null,
        tenantId: null,
        source: "none",
      };
    }

    const userDataResult: { data: { tenant_id: string | null } | null; error: any } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const userData = userDataResult.data;
    if (!userData?.tenant_id) {
      return {
        tenant: null,
        tenantId: null,
        source: "session",
      };
    }

    const tenantResult4: { data: Tenant | null; error: any } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", userData.tenant_id)
      .single();
    
    const tenant = tenantResult4.data;
    const error = tenantResult4.error;

    if (error || !tenant) {
      return {
        tenant: null,
        tenantId: null,
        source: "session",
      };
    }

    return {
      tenant,
      tenantId: tenant.id,
      source: "session",
    };
  } catch {
    return {
      tenant: null,
      tenantId: null,
      source: "session",
    };
  }
}

/**
 * Resolve tenant using priority order:
 * 1. Subdomain
 * 2. URL parameter
 * 3. Header
 * 4. Session
 */
export async function resolveTenant(options: {
  hostname?: string;
  url?: string;
  headers?: Headers | Record<string, string>;
}): Promise<TenantResolutionResult> {
  // Try subdomain first
  if (options.hostname) {
    const subdomainResult = await resolveTenantFromSubdomain(options.hostname);
    if (subdomainResult.tenant) {
      return subdomainResult;
    }
  }

  // Try URL parameter
  if (options.url) {
    const urlResult = await resolveTenantFromUrl(options.url);
    if (urlResult.tenant) {
      return urlResult;
    }
  }

  // Try header
  if (options.headers) {
    const headerResult = await resolveTenantFromHeaders(options.headers);
    if (headerResult.tenant) {
      return headerResult;
    }
  }

  // Fall back to session
  return resolveTenantFromSession();
}

/**
 * Get system mode from environment or tenant settings
 */
export async function getSystemMode(tenantId?: string | null): Promise<SystemMode> {
  // Check environment variable first
  const envMode = process.env.NEXT_PUBLIC_SYSTEM_MODE as SystemMode | undefined;
  if (envMode && (envMode === 'multi-tenant' || envMode === 'organization-only')) {
    return envMode;
  }

  // If tenantId provided, check tenant's mode setting
  if (tenantId) {
    try {
      const adminClient = createAdminClient();
      const tenantResult: { data: { mode?: string } | null; error: any } = await adminClient
        .from("tenants")
        .select("mode")
        .eq("id", tenantId)
        .single();

      if (tenantResult.data?.mode) {
        return tenantResult.data.mode as SystemMode;
      }
    } catch {
      // Fall through to default
    }
  }

  // Default to multi-tenant
  return 'multi-tenant';
}

/**
 * Get platform tenant ID for organization-only mode
 */
export async function getPlatformTenantId(): Promise<string | null> {
  try {
    const adminClient = createAdminClient();
    const platformResult: { data: { id: string } | null; error: any } = await adminClient
      .from("tenants")
      .select("id")
      .eq("domain", "platform")
      .eq("mode", "organization-only")
      .single();

    return platformResult.data?.id || null;
  } catch {
    return null;
  }
}

/**
 * Resolve organization from request (for organization-only mode)
 */
export async function resolveOrganizationFromRequest(
  headers: Headers | Record<string, string>,
  tenantId?: string | null
): Promise<Workspace | null> {
  // Try to get organization ID from header
  const orgIdHeader = headers instanceof Headers 
    ? headers.get("x-organization-id")
    : headers["x-organization-id"];

  if (!orgIdHeader) {
    return null;
  }

  try {
    const adminClient = createAdminClient();
    let query = adminClient
      .from("workspaces")
      .select("*")
      .eq("id", orgIdHeader);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const orgResult: { data: Workspace | null; error: any } = await query.single();
    return orgResult.data;
  } catch {
    return null;
  }
}

/**
 * Resolve context based on system mode
 * Handles both multi-tenant and organization-only modes
 */
export async function resolveContext(request: {
  headers: Headers | Record<string, string>;
  url?: string;
  hostname?: string;
}): Promise<TenantContext> {
  // First, resolve tenant to determine mode
  const tenantResult = await resolveTenant({
    hostname: request.hostname,
    url: request.url,
    headers: request.headers,
  });

  const mode = await getSystemMode(tenantResult.tenantId);

  if (mode === 'organization-only') {
    // Organization-only mode: Use platform tenant, focus on organizations
    const platformTenantId = tenantResult.tenantId || await getPlatformTenantId();
    const organization = await resolveOrganizationFromRequest(request.headers, platformTenantId);

    return {
      tenantId: platformTenantId,
      organizationId: organization?.id || null,
      mode: 'organization-only',
      effectiveScope: 'organization',
    };
  } else {
    // Multi-tenant mode: Standard tenant → organization hierarchy
    const organization = await resolveOrganizationFromRequest(request.headers, tenantResult.tenantId);

    return {
      tenantId: tenantResult.tenantId,
      organizationId: organization?.id || null,
      mode: 'multi-tenant',
      effectiveScope: tenantResult.tenantId ? 'tenant' : 'organization',
    };
  }
}

