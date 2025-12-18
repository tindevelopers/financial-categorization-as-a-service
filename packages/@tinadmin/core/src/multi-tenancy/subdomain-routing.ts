/**
 * Subdomain Routing Utilities
 * 
 * Handles tenant resolution from subdomains
 */

import { headers } from "next/headers";
import { createAdminClient } from "@/core/database/admin-client";

export interface SubdomainInfo {
  subdomain: string | null;
  domain: string;
  tenantId: string | null;
}

/**
 * Extract subdomain from request headers
 * Can be called from middleware (with Headers) or server components (without)
 */
export async function getSubdomainFromRequest(headersList?: Headers | Map<string, string>): Promise<SubdomainInfo> {
  let host = "";
  
  if (headersList) {
    // From middleware - Headers object
    if (headersList instanceof Headers) {
      host = headersList.get("host") || headersList.get("x-forwarded-host") || "";
    } else if (headersList instanceof Map) {
      host = headersList.get("host") || headersList.get("x-forwarded-host") || "";
    }
  } else {
    // From server component - use next/headers
    const h = await headers();
    host = h.get("host") || h.get("x-forwarded-host") || "";
  }
  
  // Remove port if present
  const hostname = host.split(":")[0];
  
  // Split by dots
  const parts = hostname.split(".");
  
  // For localhost or IP addresses, no subdomain
  if (hostname === "localhost" || hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return {
      subdomain: null,
      domain: hostname,
      tenantId: null,
    };
  }
  
  // If we have at least 3 parts (subdomain.domain.tld), extract subdomain
  if (parts.length >= 3) {
    const subdomain = parts[0];
    const domain = parts.slice(1).join(".");
    
    return {
      subdomain,
      domain,
      tenantId: null, // Will be resolved by looking up tenant by domain
    };
  }
  
  // No subdomain detected
  return {
    subdomain: null,
    domain: hostname,
    tenantId: null,
  };
}

/**
 * Get tenant ID from subdomain
 */
export async function getTenantIdFromSubdomain(
  subdomain: string
): Promise<string | null> {
  try {
    const adminClient = createAdminClient();
    
    // Look up tenant by domain (subdomain becomes the domain)
    const tenantResult: { data: { id: string } | null; error: any } = await adminClient
      .from("tenants")
      .select("id")
      .eq("domain", subdomain)
      .single();
    
    const data = tenantResult.data;
    if (tenantResult.error || !data) {
      return null;
    }
    
    return data.id;
  } catch (error) {
    console.error("Error resolving tenant from subdomain:", error);
    return null;
  }
}

/**
 * Check if current request is using subdomain routing
 */
export async function isSubdomainRouting(): Promise<boolean> {
  const subdomainInfo = await getSubdomainFromRequest();
  return subdomainInfo.subdomain !== null;
}

/**
 * Get tenant context from subdomain or fallback to session
 */
export async function getTenantContextFromSubdomain(): Promise<{
  tenantId: string | null;
  source: "subdomain" | "session" | "none";
}> {
  const subdomainInfo = await getSubdomainFromRequest();
  
  if (subdomainInfo.subdomain) {
    const tenantId = await getTenantIdFromSubdomain(subdomainInfo.subdomain);
    if (tenantId) {
      return {
        tenantId,
        source: "subdomain",
      };
    }
  }
  
  // Fallback to session-based resolution
  return {
    tenantId: null,
    source: "none",
  };
}

