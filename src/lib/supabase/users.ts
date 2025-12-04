import { createClient } from "./client";
import { createServerClient } from "./server";
import type { Database } from "./types";

type User = Database["public"]["Tables"]["users"]["Row"];
type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
type UserUpdate = Database["public"]["Tables"]["users"]["Update"];

/**
 * Get users - tenant-scoped via RLS policies
 * RLS will automatically filter by tenant_id
 */
export async function getUsers(tenantId?: string) {
  const supabase = createClient();
  
  let query = supabase
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
        domain
      )
    `)
    .order("created_at", { ascending: false });

  // Explicit tenant filter (RLS also handles this)
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Supabase error fetching users:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }
  return data || [];
}

/**
 * Get user by ID - tenant-scoped via RLS
 */
export async function getUser(id: string) {
  const supabase = createClient();
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
        domain
      )
    `)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create user - requires tenant_id
 * Validates tenant access before creation
 */
export async function createUser(user: UserInsert) {
  const supabase = createClient();
  
  if (!user.tenant_id) {
    throw new Error("tenant_id is required to create a user");
  }

  // Validate tenant access
  const { validateTenantAccess } = await import("../tenant/validation");
  const validation = await validateTenantAccess(user.tenant_id, { requireTenant: true });
  
  if (!validation.isValid) {
    throw new Error(validation.error || "Invalid tenant access");
  }

  const { data, error } = await supabase
    .from("users")
    .insert(user)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update user - tenant-scoped via RLS
 * Validates tenant access if tenant_id is being changed
 */
export async function updateUser(id: string, user: UserUpdate) {
  const supabase = createClient();
  
  // If tenant_id is being updated, validate access
  if (user.tenant_id !== undefined) {
    const { validateTenantAccess } = await import("../tenant/validation");
    const validation = await validateTenantAccess(user.tenant_id, { requireTenant: true });
    
    if (!validation.isValid) {
      throw new Error(validation.error || "Invalid tenant access");
    }
  }

  const { data, error } = await supabase
    .from("users")
    .update(user)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete user - tenant-scoped via RLS
 */
export async function deleteUser(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("users").delete().eq("id", id);

  if (error) throw error;
  return true;
}

/**
 * Update user last active timestamp
 */
export async function updateUserLastActive(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Get current authenticated user with tenant context
 */
export async function getCurrentUser() {
  const supabase = createClient();
  
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    return null;
  }

  return getUser(authUser.id);
}
