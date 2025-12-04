import { createClient } from "./client";
import { createAdminClient } from "./admin-client";
import type { Database } from "./types";

type OrganizationAdmin = Database["public"]["Tables"]["users"]["Row"] & {
  roles?: { 
    id: string;
    name: string;
    description: string;
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
 * Check if current user is a Platform Admin
 */
export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.log("[isPlatformAdmin] No authenticated user:", userError?.message);
    return false;
  }

  console.log("[isPlatformAdmin] Checking user:", user.id);

  // Use admin client to bypass RLS for this check
  const { createAdminClient } = await import("./admin-client");
  const adminClient = createAdminClient();

  const { data: currentUser, error: queryError } = await adminClient
    .from("users")
    .select("role_id, tenant_id, roles:role_id(name)")
    .eq("id", user.id)
    .single();

  if (queryError || !currentUser) {
    console.error("[isPlatformAdmin] Error fetching user:", queryError);
    return false;
  }

  const roleName = (currentUser.roles as any)?.name;
  const tenantId = currentUser.tenant_id;
  const isAdmin = roleName === "Platform Admin" && tenantId === null;
  
  console.log("[isPlatformAdmin] Result:", {
    userId: user.id,
    roleName,
    tenantId,
    isAdmin,
  });
  
  return isAdmin;
}

/**
 * Get all Organization Admins (Workspace Admins) across all tenants
 * Only accessible by Platform Admins
 */
export async function getAllOrganizationAdmins() {
  const supabase = createClient();
  
  // Check if current user is Platform Admin
  const adminStatus = await isPlatformAdmin();
  if (!adminStatus) {
    throw new Error("Only Platform Admins can view all Organization Admins");
  }

  // Get all Workspace Admins with tenant info
  // Use admin client to bypass RLS for this query
  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[getAllOrganizationAdmins] Failed to create admin client:", errorMessage);
    throw new Error(`Configuration error: ${errorMessage}. Please check your environment variables.`);
  }
  
  // First get the Workspace Admin role ID
  const { data: workspaceAdminRole } = await adminClient
    .from("roles")
    .select("id")
    .eq("name", "Workspace Admin")
    .single();

  if (!workspaceAdminRole) {
    throw new Error("Workspace Admin role not found");
  }

  // Get all Workspace Admins (tenant-scoped users only)
  const { data, error } = await adminClient
    .from("users")
    .select(`
      *,
      roles:role_id (
        id,
        name,
        description,
        permissions
      ),
      tenants:tenant_id (
        id,
        name,
        domain,
        status
      )
    `)
    .not("tenant_id", "is", null)  // Only tenant-scoped users
    .eq("role_id", workspaceAdminRole.id)  // Workspace Admin role
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching Organization Admins:", error);
    throw error;
  }
  
  return (data || []) as OrganizationAdmin[];
}

/**
 * Get Organization Admins for a specific tenant
 * Accessible by Platform Admins and tenant admins
 */
export async function getTenantOrganizationAdmins(tenantId: string) {
  const supabase = createClient();
  
  // Get Workspace Admin role ID
  const { data: workspaceAdminRole } = await supabase
    .from("roles")
    .select("id")
    .eq("name", "Workspace Admin")
    .single();

  if (!workspaceAdminRole) {
    throw new Error("Workspace Admin role not found");
  }

  const { data, error } = await supabase
    .from("users")
    .select(`
      *,
      roles:role_id (
        id,
        name,
        description,
        permissions
      ),
      tenants:tenant_id (
        id,
        name,
        domain
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("role_id", workspaceAdminRole.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tenant Organization Admins:", error);
    throw error;
  }
  
  return (data || []) as OrganizationAdmin[];
}

/**
 * Get count of Organization Admins per tenant
 * For Platform Admin dashboard
 */
export async function getOrganizationAdminsByTenant() {
  const adminStatus = await isPlatformAdmin();
  if (!adminStatus) {
    throw new Error("Only Platform Admins can view Organization Admins by tenant");
  }

  const adminClient = createAdminClient();
  
  // Get Workspace Admin role ID
  const { data: workspaceAdminRole } = await adminClient
    .from("roles")
    .select("id")
    .eq("name", "Workspace Admin")
    .single();

  if (!workspaceAdminRole) {
    throw new Error("Workspace Admin role not found");
  }

  const { data, error } = await adminClient
    .from("users")
    .select(`
      tenant_id,
      tenants:tenant_id (
        id,
        name,
        domain,
        status
      )
    `)
    .not("tenant_id", "is", null)
    .eq("role_id", workspaceAdminRole.id);

  if (error) {
    console.error("Error fetching Organization Admins by tenant:", error);
    throw error;
  }

  // Group by tenant
  const grouped = (data || []).reduce((acc: Record<string, any>, user: any) => {
    const tenantId = user.tenant_id;
    if (!acc[tenantId]) {
      acc[tenantId] = {
        tenant: user.tenants,
        count: 0,
        admins: [],
      };
    }
    acc[tenantId].count += 1;
    return acc;
  }, {});

  return Object.values(grouped);
}

