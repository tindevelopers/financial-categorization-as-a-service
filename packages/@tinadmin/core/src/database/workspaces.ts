/**
 * Workspace Management Functions
 * 
 * CRUD operations for workspaces and workspace-user relationships
 */

import { createClient } from "./client";
import { createAdminClient } from "./admin-client";
import type { Database } from "./types";
import { ensureTenantId, validateTenantAccess } from "../multi-tenancy/validation";
import { requirePermission } from "../permissions/middleware";

type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
type WorkspaceInsert = Database["public"]["Tables"]["workspaces"]["Insert"];
type WorkspaceUpdate = Database["public"]["Tables"]["workspaces"]["Update"];
type WorkspaceUser = Database["public"]["Tables"]["workspace_users"]["Row"];
type WorkspaceUserInsert = Database["public"]["Tables"]["workspace_users"]["Insert"];

/**
 * Get workspaces for a tenant
 */
export async function getWorkspaces(tenantId?: string) {
  await requirePermission("tenants.read", { tenantId });
  const supabase = createClient();
  
  const effectiveTenantId = tenantId || await ensureTenantId();
  await validateTenantAccess(effectiveTenantId!);

  const result: { data: Array<Workspace & { tenant_id: string }> | null; error: any } = await supabase
    .from("workspaces")
    .select(`
      *,
      tenant:tenant_id (
        id,
        name,
        domain
      ),
      workspace_users:workspace_users (
        id,
        user_id,
        user:users!workspace_users_user_id_fkey (
          id,
          email,
          full_name,
          avatar_url
        ),
        role_id,
        role:roles!workspace_users_role_id_fkey (
          id,
          name,
          description
        )
      )
    `)
    .eq("tenant_id", effectiveTenantId!)
    .order("created_at", { ascending: false });

  if (result.error) throw result.error;
  return result.data || [];
}

/**
 * Get workspace by ID
 */
export async function getWorkspace(id: string) {
  const supabase = createClient();
  
  const workspaceResult: { data: (Workspace & { tenant_id: string | null }) | null; error: any } = await supabase
    .from("workspaces")
    .select(`
      *,
      tenant:tenant_id (
        id,
        name,
        domain
      ),
      workspace_users:workspace_users (
        id,
        user_id,
        user:users!workspace_users_user_id_fkey (
          id,
          email,
          full_name,
          avatar_url,
          status
        ),
        role_id,
        role:roles!workspace_users_role_id_fkey (
          id,
          name,
          description,
          permissions
        ),
        permissions,
        joined_at
      )
    `)
    .eq("id", id)
    .single();

  if (workspaceResult.error) throw workspaceResult.error;
  
  const data = workspaceResult.data;
  // Validate tenant access
  if (data?.tenant_id) {
    await validateTenantAccess(data.tenant_id);
  }
  
  return data;
}

/**
 * Create workspace
 */
export async function createWorkspace(workspace: WorkspaceInsert) {
  const supabase = createClient();
  
  await ensureTenantId(workspace.tenant_id);
  await validateTenantAccess(workspace.tenant_id);

  const insertResult: { data: Workspace | null; error: any } = await ((supabase
    .from("workspaces") as any)
    .insert(workspace as any)
    .select()
    .single());
  const data = insertResult.data;
  const error = insertResult.error;

  if (error) {
    // Handle unique constraint violation (slug already exists for tenant)
    if (error.code === "23505") {
      throw new Error(`A workspace with slug "${workspace.slug}" already exists in this tenant.`);
    }
    throw error;
  }
  
  return data;
}

/**
 * Update workspace
 */
export async function updateWorkspace(id: string, updates: WorkspaceUpdate) {
  const supabase = createClient();
  
  // Get existing workspace to validate tenant access
  const existing = await getWorkspace(id);
  if (existing?.tenant_id) {
    await validateTenantAccess(existing.tenant_id);
  }

  const updateResult: { data: Workspace | null; error: any } = await ((supabase
    .from("workspaces") as any)
    .update(updates as any)
    .eq("id", id)
    .select()
    .single());
  const data = updateResult.data;
  const error = updateResult.error;

  if (error) throw error;
  return data;
}

/**
 * Delete workspace
 */
export async function deleteWorkspace(id: string) {
  const supabase = createClient();
  
  // Get existing workspace to validate tenant access
  const existing = await getWorkspace(id);
  if (existing?.tenant_id) {
    await validateTenantAccess(existing.tenant_id);
  }

  const { error } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return true;
}

/**
 * Add user to workspace
 */
export async function addUserToWorkspace(
  workspaceId: string,
  userId: string,
  roleId?: string | null,
  permissions?: string[]
) {
  const supabase = createClient();
  
  // Get workspace to validate tenant access
  const workspace = await getWorkspace(workspaceId);
  if (workspace?.tenant_id) {
    await validateTenantAccess(workspace.tenant_id);
  }

  const workspaceUser: WorkspaceUserInsert = {
    workspace_id: workspaceId,
    user_id: userId,
    role_id: roleId || null,
    permissions: permissions || [],
  };

  const insertUserResult: { data: WorkspaceUser | null; error: any } = await ((supabase
    .from("workspace_users") as any)
    .insert(workspaceUser as any)
    .select()
    .single());
  const data = insertUserResult.data;
  const error = insertUserResult.error;

  if (error) {
    // Handle unique constraint violation (user already in workspace)
    if (error.code === "23505") {
      throw new Error("User is already a member of this workspace.");
    }
    throw error;
  }
  
  return data;
}

/**
 * Remove user from workspace
 */
export async function removeUserFromWorkspace(workspaceId: string, userId: string) {
  const supabase = createClient();
  
  // Get workspace to validate tenant access
  const workspace = await getWorkspace(workspaceId);
  if (workspace?.tenant_id) {
    await validateTenantAccess(workspace.tenant_id);
  }

  const { error } = await supabase
    .from("workspace_users")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  if (error) throw error;
  return true;
}

/**
 * Update user's role/permissions in workspace
 */
export async function updateWorkspaceUser(
  workspaceId: string,
  userId: string,
  updates: {
    role_id?: string | null;
    permissions?: string[];
  }
) {
  const supabase = createClient();
  
  // Get workspace to validate tenant access
  const workspace = await getWorkspace(workspaceId);
  if (workspace?.tenant_id) {
    await validateTenantAccess(workspace.tenant_id);
  }

  const updateUserResult: { data: WorkspaceUser | null; error: any } = await ((supabase
    .from("workspace_users") as any)
    .update(updates as any)
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .select()
    .single());
  const data = updateUserResult.data;
  const error = updateUserResult.error;

  if (error) throw error;
  return data;
}

/**
 * Get user's workspaces
 */
export async function getUserWorkspaces(userId?: string) {
  const supabase = createClient();
  
  // Get current user if not provided
  let effectiveUserId = userId;
  if (!effectiveUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    effectiveUserId = user.id;
  }

  const { data, error } = await supabase
    .from("workspace_users")
    .select(`
      *,
      workspace:workspaces!workspace_users_workspace_id_fkey (
        id,
        name,
        slug,
        description,
        avatar_url,
        status,
        tenant_id,
        tenant:tenants!workspaces_tenant_id_fkey (
          id,
          name,
          domain
        )
      ),
      role:roles!workspace_users_role_id_fkey (
        id,
        name,
        description,
        permissions
      )
    `)
    .eq("user_id", effectiveUserId)
    .order("joined_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get workspace members
 */
export async function getWorkspaceMembers(workspaceId: string) {
  const supabase = createClient();
  
  // Get workspace to validate tenant access
  const workspace = await getWorkspace(workspaceId);
  if (workspace?.tenant_id) {
    await validateTenantAccess(workspace.tenant_id);
  }

  const { data, error } = await supabase
    .from("workspace_users")
    .select(`
      *,
      user:users!workspace_users_user_id_fkey (
        id,
        email,
        full_name,
        avatar_url,
        status,
        last_active_at
      ),
      role:roles!workspace_users_role_id_fkey (
        id,
        name,
        description,
        permissions
      )
    `)
    .eq("workspace_id", workspaceId)
    .order("joined_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

