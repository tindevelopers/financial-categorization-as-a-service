"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import type { Database } from "@/lib/supabase/types";

type User = Database["public"]["Tables"]["users"]["Row"] & {
  roles?: { name: string } | null;
};

/**
 * Get current authenticated user
 * Uses admin client to bypass RLS for Platform Admins
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    
    // Get current authenticated user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.log("[getCurrentUser] Auth error:", {
        message: authError.message,
        code: authError.code,
      });
      return null;
    }
    
    if (!authUser) {
      console.log("[getCurrentUser] No authenticated user");
      return null;
    }

    console.log("[getCurrentUser] Auth user found:", {
      id: authUser.id,
      email: authUser.email,
    });

    // Use admin client to bypass RLS (especially for Platform Admins)
    let adminClient;
    try {
      adminClient = createAdminClient();
    } catch (clientError) {
      console.error("[getCurrentUser] Failed to create admin client:", clientError);
      // Fallback: try with regular client (might work for some users)
      const regularClient = await createClient();
      const { data: userData, error: userError } = await regularClient
        .from("users")
        .select(`
          *,
          roles:role_id (
            name
          )
        `)
        .eq("id", authUser.id)
        .single();
      
      if (userError || !userData) {
        console.error("[getCurrentUser] Fallback query also failed:", userError);
        return null;
      }
      
      return userData as User;
    }
    
    const { data: userData, error: userError } = await adminClient
      .from("users")
      .select(`
        *,
        roles:role_id (
          name
        )
      `)
      .eq("id", authUser.id)
      .single();

    if (userError) {
      console.error("[getCurrentUser] Error fetching user:", {
        code: userError.code,
        message: userError.message,
        details: userError.details,
        hint: userError.hint,
        userId: authUser.id,
      });
      // Return null instead of throwing to avoid serialization issues
      return null;
    }

    if (!userData) {
      console.error("[getCurrentUser] No user data found for ID:", authUser.id);
      return null;
    }

    console.log("[getCurrentUser] User loaded successfully:", {
      email: userData.email,
      full_name: userData.full_name,
      role: (userData.roles as any)?.name,
      tenant_id: userData.tenant_id,
    });

    return userData as User;
  } catch (error) {
    // Better error handling - log but don't throw to avoid serialization issues
    const errorMessage = error instanceof Error 
      ? error.message 
      : String(error);
    
    console.error("[getCurrentUser] Unexpected error:", {
      message: errorMessage,
      error: error,
    });
    
    // Return null instead of throwing
    return null;
  }
}

