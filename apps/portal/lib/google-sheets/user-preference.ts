import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";

/**
 * User Preference Detection Module
 * 
 * Determines if a user is part of a corporate/Google Workspace organization
 * or an individual user, to route to appropriate authentication method.
 */

export interface UserAccountType {
  isCorporate: boolean;
  isIndividual: boolean;
  tenantId: string | null;
  tenantName: string | null;
  hasGoogleWorkspace: boolean;
}

/**
 * Detect user account type (corporate vs individual)
 */
export async function detectUserAccountType(userId: string): Promise<UserAccountType> {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  
  // Get user's tenant information
  const { data: userData } = await adminClient
    .from("users")
    .select(`
      tenant_id,
      tenants:tenant_id (
        id,
        name,
        domain,
        type
      )
    `)
    .eq("id", userId)
    .single();
  
  const tenantId = userData?.tenant_id || null;
  const tenant = (userData as any)?.tenants || null;
  const tenantName = tenant?.name || null;
  const tenantType = tenant?.type || null;
  const tenantDomain = tenant?.domain || null;
  
  // Check if tenant has Google Workspace integration settings
  let hasGoogleWorkspace = false;
  if (tenantId) {
    const { data: integrationSettings } = await adminClient
      .from("tenant_integration_settings")
      .select("provider, is_enabled")
      .eq("tenant_id", tenantId)
      .eq("provider", "google_sheets")
      .eq("is_enabled", true)
      .single();
    
    hasGoogleWorkspace = !!integrationSettings;
  }
  
  // Determine account type
  // Corporate: Has tenant_id and tenant type is 'corporate' or 'enterprise'
  // Individual: No tenant_id or tenant type is 'individual'
  const isCorporate = tenantId !== null && (
    tenantType === 'corporate' || 
    tenantType === 'enterprise' || 
    hasGoogleWorkspace
  );
  const isIndividual = !isCorporate;
  
  return {
    isCorporate,
    isIndividual,
    tenantId,
    tenantName,
    hasGoogleWorkspace,
  };
}

/**
 * Get recommended authentication method for user
 */
export async function getRecommendedAuthMethod(userId: string): Promise<"service_account" | "oauth" | "either"> {
  const accountType = await detectUserAccountType(userId);
  
  if (accountType.isCorporate && accountType.hasGoogleWorkspace) {
    // Corporate with Google Workspace should prefer service account
    return "service_account";
  } else if (accountType.isIndividual) {
    // Individual users should use OAuth
    return "oauth";
  } else {
    // Can use either method
    return "either";
  }
}

