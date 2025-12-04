import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type Role = Database["public"]["Tables"]["roles"]["Row"];

export type Permission = 
  | "users.read"
  | "users.write"
  | "users.delete"
  | "tenants.read"
  | "tenants.write"
  | "tenants.delete"
  | "roles.read"
  | "roles.write"
  | "roles.delete"
  | "billing.read"
  | "billing.write"
  | "settings.read"
  | "settings.write"
  | "analytics.read"
  | "api.access"
  | "audit.read";

export interface UserPermissions {
  role: string | null;
  permissions: Permission[];
  isPlatformAdmin: boolean;
}

/**
 * Get user permissions based on their role
 */
export async function getUserPermissions(userId: string): Promise<UserPermissions> {
  const supabase = createClient();
  
  const { data: user, error } = await supabase
    .from("users")
    .select(`
      role_id,
      roles:role_id (
        name,
        permissions
      )
    `)
    .eq("id", userId)
    .single();

  if (error || !user) {
    return {
      role: null,
      permissions: [],
      isPlatformAdmin: false,
    };
  }

  const role = user.roles as Role | null;
  const roleName = role?.name || null;
  const isPlatformAdmin = roleName === "Platform Admin";

  // Extract permissions from role
  const rolePermissions = (role?.permissions || []) as string[];
  
  // Map role permissions to Permission type
  const permissions: Permission[] = [];
  
  // Platform Admin has all permissions
  if (isPlatformAdmin) {
    return {
      role: roleName,
      permissions: [
        "users.read",
        "users.write",
        "users.delete",
        "tenants.read",
        "tenants.write",
        "tenants.delete",
        "roles.read",
        "roles.write",
        "roles.delete",
        "billing.read",
        "billing.write",
        "settings.read",
        "settings.write",
        "analytics.read",
        "api.access",
        "audit.read",
      ],
      isPlatformAdmin: true,
    };
  }

  // Map role permissions based on role name
  if (roleName === "Workspace Admin") {
    permissions.push(
      "users.read",
      "users.write",
      "tenants.read",
      "tenants.write",
      "roles.read",
      "roles.write",
      "settings.read",
      "settings.write",
      "analytics.read"
    );
  } else if (roleName === "Billing Owner") {
    permissions.push(
      "billing.read",
      "billing.write",
      "analytics.read"
    );
  } else if (roleName === "Developer") {
    permissions.push(
      "api.access",
      "settings.read",
      "analytics.read"
    );
  } else if (roleName === "Viewer") {
    permissions.push(
      "users.read",
      "tenants.read",
      "roles.read",
      "analytics.read"
    );
  }

  return {
    role: roleName,
    permissions,
    isPlatformAdmin: false,
  };
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(
  userId: string,
  permission: Permission
): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId);
  return userPermissions.permissions.includes(permission) || userPermissions.isPlatformAdmin;
}

/**
 * Check if user has any of the specified permissions
 */
export async function hasAnyPermission(
  userId: string,
  permissions: Permission[]
): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId);
  if (userPermissions.isPlatformAdmin) return true;
  
  return permissions.some(permission => 
    userPermissions.permissions.includes(permission)
  );
}

/**
 * Check if user has all of the specified permissions
 */
export async function hasAllPermissions(
  userId: string,
  permissions: Permission[]
): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId);
  if (userPermissions.isPlatformAdmin) return true;
  
  return permissions.every(permission => 
    userPermissions.permissions.includes(permission)
  );
}

