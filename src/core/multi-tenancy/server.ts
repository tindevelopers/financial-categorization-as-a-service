/**
 * Server-side tenant utilities
 */

import { createClient } from "@/core/database/server";
import { cookies, headers } from "next/headers";

/**
 * Get current tenant ID from user session
 * For Platform Admins, returns null (they don't have a tenant)
 * For regular users, returns their tenant_id
 * Uses admin client to bypass RLS and avoid infinite recursion
 */
export async function getCurrentTenant(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    // Use admin client to bypass RLS and avoid infinite recursion
    // The RLS policies on users table can cause recursion when querying users from within a policy
    const { createAdminClient } = await import("@/core/database/admin-client");
    const adminClient = createAdminClient();

    // Get user's tenant_id and role using admin client (bypasses RLS)
    const userDataResult: { data: { tenant_id: string | null; role_id: string | null } | null; error: any } = await (adminClient.from("users") as any)
      .select("tenant_id, role_id")
      .eq("id", user.id)
      .single();

    const userData = userDataResult.data;
    if (!userData) {
      return null;
    }

    // Platform Admins have tenant_id = NULL
    // They need to select a tenant context for CRM operations
    if (userData.tenant_id === null) {
      // Check if user is Platform Admin
      if (userData.role_id) {
        const roleResult: { data: { name: string } | null; error: any } = await (adminClient.from("roles") as any)
          .select("name")
          .eq("id", userData.role_id)
          .single();

        if (roleResult.data?.name === "Platform Admin") {
          // Platform Admin - return null (they need to select a tenant)
          return null;
        }
      }
    }

    return userData.tenant_id || null;
  } catch (error) {
    console.error("Error getting current tenant:", error);
    return null;
  }
}


/**
 * Get current tenant details
 */
export async function getCurrentTenantDetails(): Promise<any | null> {
  try {
    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return null;
    }

    const supabase = await createClient();
    const { data } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .single();

    return data;
  } catch (error) {
    console.error("Error getting current tenant details:", error);
    return null;
  }
}

/**
 * Validate tenant access for a user
 * Uses admin client to bypass RLS and avoid infinite recursion
 */
export async function validateTenantAccess(tenantId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    // Use admin client to bypass RLS and avoid infinite recursion
    const { createAdminClient } = await import("@/core/database/admin-client");
    const adminClient = createAdminClient();

    // Check if user has access to this tenant using admin client
    const userDataResult2: { data: { tenant_id: string | null; role_id: string | null } | null; error: any } = await (adminClient.from("users") as any)
      .select("tenant_id, role_id")
      .eq("id", user.id)
      .single();

    const userData = userDataResult2.data;
    if (!userData) {
      return false;
    }

    // Platform admins have access to all tenants
    if (!userData.role_id) {
      return false;
    }
    const roleResult: { data: { name: string } | null; error: any } = await (adminClient.from("roles") as any)
      .select("name")
      .eq("id", userData.role_id)
      .single();

    const role = roleResult.data;
    if (role?.name === "Platform Admin") {
      return true;
    }

    // Regular users can only access their own tenant
    return userData.tenant_id === tenantId;
  } catch (error) {
    console.error("Error validating tenant access:", error);
    return false;
  }
}

