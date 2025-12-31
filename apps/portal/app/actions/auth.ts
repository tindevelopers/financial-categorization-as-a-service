"use server";

import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  tenantName: string;
  tenantDomain: string;
  plan?: string;
  region?: string;
  subscriptionType?: "individual" | "company" | "enterprise";
}

export interface SignInData {
  email: string;
  password: string;
}

/**
 * Sign up a new user and create their tenant
 * This is a server action that uses the admin client to bypass RLS
 */
export async function signUp(data: SignUpData) {
  const adminClient = createAdminClient();

  try {
    // 1. Check if tenant already exists, if so use it
    let tenant: any = null;
    let isNewTenant = false;
    
    // Use admin client to bypass RLS when checking for existing tenant
    let existingTenant = null;
    let checkError = null;
    
    try {
      const result = await adminClient
        .from("tenants")
        .select("*")
        .eq("domain", data.tenantDomain)
        .maybeSingle();
      
      existingTenant = result.data;
      checkError = result.error;
    } catch (err: any) {
      checkError = err;
      console.error("Error checking for existing tenant:", err);
    }
    
    // If we get a function error, try to query without RLS by using a different approach
    if (checkError?.code === "42P17") {
      console.warn("Function error detected, trying alternative query method...");
      // Try querying all tenants and filtering in code (admin client should bypass RLS)
      try {
        const result: { data: any[] | null; error: any } = await adminClient
          .from("tenants")
          .select("*");
        
        const allTenants = result.data;
        const altError = result.error;
        
        if (!altError && allTenants) {
          existingTenant = allTenants.find((t: any) => t.domain === data.tenantDomain) || null;
          checkError = null;
        }
      } catch (altErr) {
        console.error("Alternative query also failed:", altErr);
      }
    } else if (checkError && checkError.code !== "42P17") {
      throw checkError;
    }

    if (existingTenant) {
      // Tenant exists, use it
      tenant = existingTenant;
      console.log("Using existing tenant:", tenant.id);
    } else {
      // Create new tenant
      const tenantData: any = {
        name: data.tenantName,
        domain: data.tenantDomain,
        plan: data.plan || "starter",
        region: data.region || "us-east-1",
        status: "pending",
        subscription_type: data.subscriptionType || "individual",
      };

      const result: { data: any | null; error: any } = await adminClient
        .from("tenants")
        .insert(tenantData)
        .select()
        .single();
      
      const newTenant = result.data;
      const tenantError = result.error;

      if (tenantError || !newTenant) {
        // Handle unique constraint violation (domain already exists)
        if (tenantError?.code === "23505") {
          // Try to get the existing tenant
          const existingResult: { data: any | null; error: any } = await adminClient
            .from("tenants")
            .select("*")
            .eq("domain", data.tenantDomain)
            .single();
          
          const existing = existingResult.data;
          if (existing) {
            tenant = existing;
          } else {
            throw new Error(`A tenant with domain "${data.tenantDomain}" already exists. Please choose a different domain.`);
          }
        } else {
          throw tenantError || new Error("Failed to create tenant");
        }
      } else {
        tenant = newTenant;
        isNewTenant = true; // Mark as newly created
      }
    }

    // 2. Sign up user with Supabase Auth using admin client
    const { data: authData, error: authError } = await adminClient.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          tenant_id: tenant.id,
        },
      },
    });

    if (authError || !authData.user) {
      // If auth fails and we created a NEW tenant, clean it up
      // Don't delete existing tenants!
      if (isNewTenant) {
        try {
          await adminClient.from("tenants").delete().eq("id", tenant.id);
        } catch (cleanupError) {
          console.error("Failed to cleanup tenant:", cleanupError);
        }
      }
      
      // Handle unique constraint violation (email already exists)
      if (
        authError?.message?.includes("already registered") || 
        authError?.message?.includes("already exists") ||
        authError?.message?.includes("User already registered") ||
        authError?.status === 422
      ) {
        throw new Error(`An account with email "${data.email}" already exists. Please sign in instead.`);
      }
      
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

    // Regular users belong to their tenant
    const userData: any = {
      id: authData.user.id,
      email: data.email,
      full_name: data.fullName,
      tenant_id: tenant.id,
      role_id: defaultRole?.id || null,
      plan: data.plan || "starter",
      status: "active",
    };

    const userResult: { data: any | null; error: any } = await adminClient
      .from("users")
      .insert(userData)
      .select()
      .single();
    
    const user = userResult.data;
    const userError = userResult.error;

    if (userError || !user) {
      // If user creation fails, clean up ONLY if we created a new tenant
      // Don't delete existing tenants!
      if (isNewTenant) {
        try {
          await adminClient.from("tenants").delete().eq("id", tenant.id);
        } catch (cleanupError) {
          console.error("Failed to cleanup tenant:", cleanupError);
        }
      }
      
      // Always try to clean up auth user if it was created
      if (authData.user) {
        try {
          await adminClient.auth.admin.deleteUser(authData.user.id);
        } catch (deleteError) {
          // Ignore delete errors during cleanup
          console.error("Failed to delete auth user during cleanup:", deleteError);
        }
      }
      
      // Handle unique constraint violation (email already exists)
      if (
        userError?.code === "23505" || 
        userError?.message?.includes("duplicate") || 
        userError?.message?.includes("unique") ||
        userError?.message?.includes("already exists")
      ) {
        throw new Error(`An account with email "${data.email}" already exists. Please sign in instead.`);
      }
      
      throw userError || new Error("Failed to create user record");
    }

    return {
      user,
      tenant,
      session: authData.session,
    };
  } catch (error) {
    console.error("Signup error:", error);
    throw error;
  }
}

