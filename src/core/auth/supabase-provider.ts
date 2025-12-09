import { createClient as createBrowserClient } from "@/core/database/client";
import { createAdminClient } from "@/core/database/admin-client";
import type { Database } from "@/core/database/types";

type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
type TenantInsert = Database["public"]["Tables"]["tenants"]["Insert"];

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  tenantName: string;
  tenantDomain: string;
  plan?: string;
  region?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

/**
 * Sign up a new user and create their tenant
 */
export async function signUp(data: SignUpData) {
  const supabase = createBrowserClient();
  
  // Use admin client for tenant creation (bypasses RLS)
  // This is safe because we're creating the tenant as part of signup
  const adminClient = createAdminClient();

  // 1. Create tenant first using admin client
  const tenantData: TenantInsert = {
    name: data.tenantName,
    domain: data.tenantDomain,
    plan: data.plan || "starter",
    region: data.region || "us-east-1",
    status: "pending",
  };

  const tenantResult: { data: any | null; error: any } = await ((adminClient
    .from("tenants") as any)
    .insert(tenantData as any)
    .select()
    .single());
  const tenant = tenantResult.data;
  const tenantError = tenantResult.error;

  if (tenantError || !tenant) {
    throw tenantError || new Error("Failed to create tenant");
  }

  // 2. Sign up user with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          tenant_id: (tenant as any).id,
        },
      },
  });

  if (authError || !authData.user) {
    throw authError || new Error("Failed to create user");
  }

    // 3. Create user record in users table using admin client
    // Get default "Organization Admin" role
    const roleResult: { data: { id: string } | null; error: any } = await adminClient
      .from("roles")
      .select("id")
      .eq("name", "Organization Admin")
      .single();
    const defaultRole = roleResult.data;

    const userData: UserInsert = {
      id: authData.user.id,
      email: data.email,
      full_name: data.fullName,
      tenant_id: (tenant as any).id,
      role_id: defaultRole?.id || null,
      plan: data.plan || "starter",
      status: "active",
    };

    const userInsertResult: { data: any | null; error: any } = await ((adminClient
      .from("users") as any)
      .insert(userData as any)
      .select()
      .single());
    const user = userInsertResult.data;
    const userError = userInsertResult.error;

  if (userError || !user) {
    throw userError || new Error("Failed to create user record");
  }

  return {
    user,
    tenant,
    session: authData.session,
  };
}

/**
 * Sign in existing user
 */
export async function signIn(data: SignInData) {
  const supabase = createBrowserClient();

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error || !authData.user) {
    throw error || new Error("Failed to sign in");
  }

  // Get user with tenant context using admin client
  const adminClient = createAdminClient();
  const userResult: { data: any | null; error: any } = await adminClient
    .from("users")
    .select("*")
    .eq("id", authData.user.id)
    .single();
  
  const user = userResult.data;
  if (userResult.error || !user) {
    throw userResult.error || new Error("Failed to fetch user");
  }

  // Update last active timestamp
  await ((supabase
    .from("users") as any)
    .update({ last_active_at: new Date().toISOString() } as any)
    .eq("id", authData.user.id));

  return {
    user,
    session: authData.session,
  };
}

/**
 * Sign out current user
 */
export async function signOut() {
  const supabase = createBrowserClient();
  const { error } = await supabase.auth.signOut();
  
  if (error) throw error;
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  const supabase = createBrowserClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) return null;
  
  const adminClient = createAdminClient();
  const userResult: { data: any | null; error: any } = await adminClient
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();
  
  return userResult.data || null;
}

/**
 * Get current session
 */
export async function getCurrentSession() {
  const supabase = createBrowserClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) throw error;
  return session;
}

/**
 * Reset password
 */
export async function resetPassword(email: string) {
  const supabase = createBrowserClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
  
  if (error) throw error;
}

/**
 * Update password
 */
export async function updatePassword(newPassword: string) {
  const supabase = createBrowserClient();
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  
  if (error) throw error;
}

