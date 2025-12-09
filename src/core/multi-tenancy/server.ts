/**
 * Server-side tenant utilities
 */

import { createClient } from "@/core/database/server";
import { cookies, headers } from "next/headers";

/**
 * Get current tenant ID from user session
 */
export async function getCurrentTenant(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    // Get user's tenant_id
    const userDataResult: { data: { tenant_id: string | null } | null; error: any } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const userData = userDataResult.data;
    return userData?.tenant_id || null;
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
 */
export async function validateTenantAccess(tenantId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    // Check if user has access to this tenant
    const userDataResult2: { data: { tenant_id: string | null; role_id: string | null } | null; error: any } = await supabase
      .from("users")
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
    const roleResult: { data: { name: string } | null; error: any } = await supabase
      .from("roles")
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

