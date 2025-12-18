"use server";

import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import type { Database } from "@/core/database";
import { isPlatformAdmin } from "./organization-admins";
import { requirePermission } from "@/core/permissions/middleware";

type User = Database["public"]["Tables"]["users"]["Row"] & {
  roles?: { 
    id: string;
    name: string;
    description: string;
    coverage: string;
    permissions: string[];
  } | null;
  tenants?: { 
    id: string;
    name: string;
    domain: string;
    status: string;
  } | null;
};

/**
 * Get all users that the current user has access to
 * 
 * BEST PRACTICE SECURITY MODEL:
 * - Platform Admins see:
 *   1. All Platform Admins (system-level users with tenant_id = NULL)
 *   2. Users from tenants they're explicitly added to (as Tenant Admin/Org Admin)
 * - Regular users see only users in their tenant (via RLS)
 * 
 * This maintains proper tenant isolation and privacy compliance.
 */
export async function getAllUsers(): Promise<User[]> {
  // Check permission
  await requirePermission("users.read");
  
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      throw new Error("Not authenticated");
    }
    
    // Check if current user is Platform Admin
    const isAdmin = await isPlatformAdmin();
    
    if (isAdmin) {
      // Platform Admin: See Platform Admins + users from tenants they're members of
      console.log("[getAllUsers] Platform Admin detected - fetching accessible users");
      const adminClient = createAdminClient();
      
      // First, get all Platform Admins (system-level users)
      const { data: platformAdmins, error: platformError } = await adminClient
        .from("users")
        .select(`
          *,
          roles:role_id (
            id,
            name,
            description,
            coverage,
            permissions
          ),
          tenants:tenant_id (
            id,
            name,
            domain,
            status
          )
        `)
        .is("tenant_id", null)
        .order("created_at", { ascending: false });
      
      if (platformError) {
        console.error("[getAllUsers] Error fetching Platform Admins:", platformError);
        throw platformError;
      }
      
      // Get tenants this Platform Admin is a member of
      // (Platform Admins can be added to tenants as Tenant Admin/Org Admin)
      const membershipResult: { data: Array<{ tenant_id: string }> | null; error: any } = await adminClient
        .from("users")
        .select("tenant_id")
        .eq("id", authUser.id)
        .not("tenant_id", "is", null);
      
      const tenantMemberships = membershipResult.data;
      if (membershipResult.error) {
        console.error("[getAllUsers] Error fetching tenant memberships:", membershipResult.error);
        // Continue anyway - might not be a member of any tenant
      }
      
      const accessibleTenantIds = tenantMemberships?.map(m => m.tenant_id).filter(Boolean) || [];
      
      let tenantUsers: User[] = [];
      
      // If Platform Admin is a member of any tenants, get users from those tenants
      if (accessibleTenantIds.length > 0) {
        const { data: tenantUsersData, error: tenantUsersError } = await adminClient
          .from("users")
          .select(`
            *,
            roles:role_id (
              id,
              name,
              description,
              coverage,
              permissions
            ),
            tenants:tenant_id (
              id,
              name,
              domain,
              status
            )
          `)
          .in("tenant_id", accessibleTenantIds)
          .order("created_at", { ascending: false });
        
        if (tenantUsersError) {
          console.error("[getAllUsers] Error fetching tenant users:", tenantUsersError);
          // Continue with just Platform Admins if tenant query fails
        } else {
          tenantUsers = (tenantUsersData || []) as User[];
        }
      }
      
      // Combine Platform Admins + tenant users
      const allUsers = [
        ...(platformAdmins || []),
        ...tenantUsers
      ] as User[];
      
      console.log(`[getAllUsers] Fetched ${allUsers.length} users:`);
      console.log(`  - ${platformAdmins?.length || 0} Platform Admins`);
      console.log(`  - ${tenantUsers.length} users from ${accessibleTenantIds.length} tenant(s)`);
      
      return allUsers;
    } else {
      // Regular user: Use regular client (RLS will filter by tenant)
      console.log("[getAllUsers] Regular user - fetching tenant-scoped users");
      const { data, error } = await supabase
        .from("users")
        .select(`
          *,
          roles:role_id (
            id,
            name,
            description,
            coverage,
            permissions
          ),
          tenants:tenant_id (
            id,
            name,
            domain,
            status
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("[getAllUsers] Error fetching tenant users:", error);
        throw error;
      }
      
      console.log(`[getAllUsers] Fetched ${data?.length || 0} users (tenant-scoped)`);
      return (data || []) as User[];
    }
  } catch (error) {
    console.error("[getAllUsers] Unexpected error:", error);
    throw error;
  }
}

