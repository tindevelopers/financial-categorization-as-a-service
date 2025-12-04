/**
 * Tenant Resolution Utilities
 * 
 * Resolves tenant from various sources: subdomain, URL params, session, headers
 */

import { createClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import type { Database } from "@/lib/supabase/types";
import { extractTenantFromSubdomain, extractTenantIdFromRequest } from "./query-builder";

type Tenant = Database["public"]["Tables"]["tenants"]["Row"];

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
    const { data: tenant, error } = await adminClient
      .from("tenants")
      .select("*")
      .eq("domain", subdomain)
      .single();

    if (error || !tenant) {
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
    const { data: tenant, error } = await adminClient
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .single();

    if (error || !tenant) {
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
    const { data: tenant, error } = await adminClient
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .single();

    if (error || !tenant) {
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

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return {
        tenant: null,
        tenantId: null,
        source: "session",
      };
    }

    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", userData.tenant_id)
      .single();

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

