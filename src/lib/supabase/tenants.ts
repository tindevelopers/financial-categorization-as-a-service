import { createClient } from "./client";
import type { Database } from "./types";

type Tenant = Database["public"]["Tables"]["tenants"]["Row"];
type TenantInsert = Database["public"]["Tables"]["tenants"]["Insert"];
type TenantUpdate = Database["public"]["Tables"]["tenants"]["Update"];

/**
 * Get tenants - RLS policies handle tenant isolation
 * Platform admins see all, regular users see only their tenant
 */
export async function getTenants() {
  const supabase = createClient();
  
  // Check session first
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  console.log("[getTenants] Session check:", {
    hasSession: !!session,
    userId: session?.user?.id,
    sessionError: sessionError?.message,
  });

  // Get current user to check role
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log("[getTenants] User check:", {
    hasUser: !!user,
    userId: user?.id,
    userError: userError?.message,
  });

  // If we have a user, check their role
  if (user) {
    const { data: userData, error: roleError } = await supabase
      .from("users")
      .select("role_id, roles:role_id(name)")
      .eq("id", user.id)
      .single();
    
    console.log("[getTenants] User role check:", {
      roleId: userData?.role_id,
      roleName: (userData?.roles as any)?.name,
      roleError: roleError?.message,
    });
  }

  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getTenants] Supabase error fetching tenants:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }
  
  console.log("[getTenants] Successfully fetched tenants:", data?.length || 0);
  return data || [];
}

/**
 * Get tenant by ID - RLS handles access control
 */
export async function getTenant(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tenants")
    .select(`
      *,
      users:users!tenant_id (
        id,
        email,
        full_name,
        status,
        role_id
      )
    `)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create tenant - typically only platform admins can do this
 * Validates domain format before creation
 */
export async function createTenant(tenant: TenantInsert) {
  const supabase = createClient();
  
  // Validate domain format
  if (tenant.domain) {
    const { validateTenantDomain } = await import("../tenant/validation");
    const validation = validateTenantDomain(tenant.domain);
    
    if (!validation.isValid) {
      throw new Error(validation.error || "Invalid domain format");
    }
  }

  const { data, error } = await supabase
    .from("tenants")
    .insert(tenant)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update tenant - RLS handles access control
 */
export async function updateTenant(id: string, tenant: TenantUpdate) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tenants")
    .update(tenant)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete tenant - typically only platform admins can do this
 */
export async function deleteTenant(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("tenants").delete().eq("id", id);

  if (error) throw error;
  return true;
}
