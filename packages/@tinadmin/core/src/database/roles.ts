import { createClient } from "./client";
import type { Database } from "./types";

type Role = Database["public"]["Tables"]["roles"]["Row"];
type RoleInsert = Database["public"]["Tables"]["roles"]["Insert"];
type RoleUpdate = Database["public"]["Tables"]["roles"]["Update"];

export async function getRoles() {
  const supabase = createClient();
  const rolesResult: { data: Role[] | null; error: any } = await supabase
    .from("roles")
    .select("*")
    .order("created_at", { ascending: false });

  const roles = rolesResult.data;
  if (rolesResult.error) throw rolesResult.error;

  // Fetch user counts for each role
  const roleIds = (roles || []).map(r => r.id);
  const usersResult: { data: { role_id: string }[] | null; error: any } = await supabase
    .from("users")
    .select("role_id")
    .in("role_id", roleIds);

  const users = usersResult.data;
  // Update current_seats based on actual user count
  return (roles || []).map((role) => {
    const roleUsers = users?.filter(u => u.role_id === role.id) || [];
    return {
      ...role,
      current_seats: roleUsers.length,
    };
  });
}

export async function getRoleById(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("roles")
    .select(`
      *,
      users:users!role_id (
        id,
        email,
        full_name
      )
    `)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createRole(role: RoleInsert) {
  const supabase = createClient();
  const result: { data: Role | null; error: any } = await ((supabase
    .from("roles") as any)
    .insert(role as any)
    .select()
    .single());

  const data = result.data;
  if (result.error) throw result.error;
  return data;
}

export async function updateRole(id: string, updates: RoleUpdate) {
  const supabase = createClient();
  const result: { data: Role | null; error: any } = await ((supabase
    .from("roles") as any)
    .update(updates as any)
    .eq("id", id)
    .select()
    .single());

  const data = result.data;
  if (result.error) throw result.error;
  return data;
}

export async function deleteRole(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("roles").delete().eq("id", id);

  if (error) throw error;
}

