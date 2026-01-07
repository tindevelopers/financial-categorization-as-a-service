/**
 * Entity Type Detection
 * 
 * Determines whether a user is an individual or company based on their profile
 */

import { createClient } from '@/lib/database/server';

export type EntityType = 'individual' | 'company';

export interface EntityInfo {
  type: EntityType;
  companyProfile: CompanyProfile | null;
  tenantId: string | null;
}

export interface CompanyProfile {
  id: string;
  user_id: string;
  tenant_id: string | null;
  company_name: string;
  company_type: 'sole_trader' | 'limited_company' | 'partnership' | 'individual';
  vat_registered: boolean;
  setup_completed: boolean;
}

/**
 * Get the entity type for the current user
 * 
 * - Individual: user has no company profile OR company_type is 'individual'
 * - Company: user has a company profile with company_type other than 'individual'
 * 
 * @returns EntityInfo with type and profile details
 */
export async function getEntityInfo(): Promise<EntityInfo> {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return {
      type: 'individual',
      companyProfile: null,
      tenantId: null,
    };
  }
  
  // Get user's tenant_id
  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id, email, full_name')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string | null; email: string | null; full_name: string | null } | null };
  
  let tenantId = userData?.tenant_id || null;
  
  // If user doesn't have a tenant_id, create one automatically
  // This handles cases where users were created before the tenant system or signup failed partway
  if (!tenantId && userData) {
    try {
      const { createAdminClient } = await import('@/lib/database/admin-client');
      const adminClient = createAdminClient();
      
      // Generate tenant domain from email or use a default
      const tenantDomain = userData.email 
        ? `${userData.email.split('@')[0]}-${Date.now().toString().slice(-6)}`
        : `user-${user.id.slice(0, 8)}`;
      
      const tenantName = userData.full_name 
        ? `${userData.full_name}'s Organization`
        : 'My Organization';
      
      // Create tenant
      const { data: newTenant, error: tenantError } = await adminClient
        .from('tenants')
        .insert({
          name: tenantName,
          domain: tenantDomain,
          plan: 'starter',
          region: 'us-east-1',
          status: 'active',
          subscription_type: 'individual',
        })
        .select()
        .single();
      
      if (!tenantError && newTenant) {
        // Update user with tenant_id
        const { error: updateError } = await adminClient
          .from('users')
          .update({ tenant_id: newTenant.id })
          .eq('id', user.id);
        
        if (!updateError) {
          tenantId = newTenant.id;
          console.log(`[getEntityInfo] Created tenant ${tenantId} for user ${user.id}`);
        } else {
          console.error('[getEntityInfo] Failed to update user with tenant_id:', updateError);
        }
      } else {
        console.error('[getEntityInfo] Failed to create tenant:', tenantError);
      }
    } catch (error) {
      console.error('[getEntityInfo] Error creating tenant:', error);
      // Continue without tenant - will show error to user
    }
  }
  
  // Check for company profile
  type CompanyProfileRow = {
    id: string;
    user_id: string;
    tenant_id: string | null;
    company_name: string;
    company_type: 'sole_trader' | 'limited_company' | 'partnership' | 'individual';
    vat_registered: boolean;
    setup_completed: boolean;
  };
  
  const { data: profile, error: profileError } = await supabase
    .from('company_profiles')
    .select('id, user_id, tenant_id, company_name, company_type, vat_registered, setup_completed')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single() as { data: CompanyProfileRow | null; error: any };
  
  if (profileError || !profile) {
    // No company profile - treat as individual
    return {
      type: 'individual',
      companyProfile: null,
      tenantId,
    };
  }
  
  // Check the company type
  const companyProfile: CompanyProfile = {
    id: profile.id,
    user_id: profile.user_id,
    tenant_id: profile.tenant_id,
    company_name: profile.company_name,
    company_type: profile.company_type,
    vat_registered: profile.vat_registered || false,
    setup_completed: profile.setup_completed || false,
  };
  
  // 'individual' company_type is treated as individual entity
  const entityType: EntityType = profile.company_type === 'individual' ? 'individual' : 'company';
  
  return {
    type: entityType,
    companyProfile,
    tenantId,
  };
}

/**
 * Check if current user is a company/organization
 */
export async function isCompanyEntity(): Promise<boolean> {
  const entityInfo = await getEntityInfo();
  return entityInfo.type === 'company';
}

/**
 * Check if current user is an individual
 */
export async function isIndividualEntity(): Promise<boolean> {
  const entityInfo = await getEntityInfo();
  return entityInfo.type === 'individual';
}

/**
 * Get features available for the entity type
 */
export function getEntityFeatures(entityType: EntityType): {
  canUseCustomCredentials: boolean;
  canUseAirtable: boolean;
  canShareWithAccountant: boolean;
  canHaveMultipleSources: boolean;
} {
  if (entityType === 'company') {
    return {
      canUseCustomCredentials: true,
      canUseAirtable: true,
      canShareWithAccountant: true,
      canHaveMultipleSources: true,
    };
  }
  
  // Individual users get basic features
  return {
    canUseCustomCredentials: false,
    canUseAirtable: false,
    canShareWithAccountant: false,
    canHaveMultipleSources: false,
  };
}

