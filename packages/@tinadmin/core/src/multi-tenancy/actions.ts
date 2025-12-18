"use server";

import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import { isPlatformAdmin } from "@/core/database/organization-admins";
import type { Database } from "@/core/database";
import { requirePermission } from "@/core/permissions/middleware";

type Tenant = Database["public"]["Tables"]["tenants"]["Row"] & {
  userCount?: number;
};

/**
 * Get all tenants that the current user has access to
 * 
 * BEST PRACTICE SECURITY MODEL:
 * - Platform Admins see all tenants (for platform management)
 * - Regular users see only their own tenant (via RLS)
 * 
 * Note: Platform Admins can see tenant metadata but need explicit
 * membership to access tenant users (see getAllUsers)
 */
export async function getAllTenants(): Promise<Tenant[]> {
  // Check permission
  await requirePermission("tenants.read");
  
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      throw new Error("Not authenticated");
    }
    
    // Check if current user is Platform Admin
    const isAdmin = await isPlatformAdmin();
    
    if (isAdmin) {
      // Platform Admin: Use admin client to see all tenants
      console.log("[getAllTenants] Platform Admin detected - fetching all tenants");
      const adminClient = createAdminClient();
      
      const { data, error } = await adminClient
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("[getAllTenants] Error fetching all tenants:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }
      
      // Get user counts per tenant
      const tenantIds = (data || []).map((t: Tenant) => t.id);
      let userCounts: Record<string, number> = {};
      
      if (tenantIds.length > 0) {
        const usersResult: { data: Array<{ tenant_id: string }> | null; error: any } = await adminClient
          .from("users")
          .select("tenant_id")
          .in("tenant_id", tenantIds);
        
        const users = usersResult.data || [];
        userCounts = users.reduce((acc: Record<string, number>, user) => {
          if (user.tenant_id) {
            acc[user.tenant_id] = (acc[user.tenant_id] || 0) + 1;
          }
          return acc;
        }, {});
      }
      
      const tenantsWithCounts = (data || []).map((tenant: Tenant) => ({
        ...tenant,
        userCount: userCounts[tenant.id] || 0,
      }));
      
      console.log(`[getAllTenants] Fetched ${tenantsWithCounts.length} tenants (Platform Admin view)`);
      return tenantsWithCounts as Tenant[];
    } else {
      // Regular user: Use regular client (RLS will filter to their tenant)
      console.log("[getAllTenants] Regular user - fetching tenant-scoped tenants");
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("[getAllTenants] Error fetching tenant:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }
      
      // Get user count for this tenant
      let userCount = 0;
      if (data && data.length > 0) {
        const tenantId = (data[0] as Tenant).id;
        const usersResult: { data: Array<{ id: string }> | null; error: any } = await supabase
          .from("users")
          .select("id")
          .eq("tenant_id", tenantId);
        
        userCount = usersResult.data?.length || 0;
      }
      
      const tenantsWithCounts = (data || []).map((tenant: Tenant) => ({
        ...tenant,
        userCount,
      }));
      
      console.log(`[getAllTenants] Fetched ${tenantsWithCounts.length} tenant(s) (tenant-scoped)`);
      return tenantsWithCounts as Tenant[];
    }
  } catch (error) {
    console.error("[getAllTenants] Unexpected error:", error);
    
    // Better error serialization for client
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("Failed to fetch tenants");
  }
}

