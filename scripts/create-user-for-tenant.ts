/**
 * Script to create a user for an existing tenant
 * Run with: npx tsx scripts/create-user-for-tenant.ts
 * 
 * This is useful when a tenant was created but the user creation failed
 */

import { createAdminClient } from "../src/lib/supabase/admin-client";
import type { Database } from "../src/lib/supabase/types";

type UserInsert = Database["public"]["Tables"]["users"]["Insert"];

async function createUserForTenant() {
  const adminClient = createAdminClient();

  // Get tenant ID from user input or use the one from the image
  const tenantId = process.argv[2] || "d0e6cbf4-cf74-4d49-a95c-2da69a33a5d"; // From the image
  
  if (!tenantId) {
    console.error("Please provide a tenant ID");
    console.log("Usage: npx tsx scripts/create-user-for-tenant.ts <tenant-id>");
    process.exit(1);
  }

  // Get tenant info
  const { data: tenant, error: tenantError } = await adminClient
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();

  if (tenantError || !tenant) {
    console.error("Tenant not found:", tenantError);
    process.exit(1);
  }

  console.log(`\n📋 Creating user for tenant: ${tenant.name} (${tenant.domain})\n`);

  // Get default role
  const { data: defaultRole } = await adminClient
    .from("roles")
    .select("id, name")
    .eq("name", "Workspace Admin")
    .single();

  if (!defaultRole) {
    console.error("Default role 'Workspace Admin' not found");
    process.exit(1);
  }

  // Prompt for user details (in a real scenario, you'd use readline)
  const email = process.argv[3] || "admin@saas-base.com";
  const fullName = process.argv[4] || "Admin User";
  const password = process.argv[5] || "changeme123";

  console.log(`Creating user:`);
  console.log(`  Email: ${email}`);
  console.log(`  Name: ${fullName}`);
  console.log(`  Tenant: ${tenant.name}`);
  console.log(`  Role: ${defaultRole.name}\n`);

  try {
    // 1. Create auth user
    console.log("1. Creating Supabase Auth user...");
    const { data: authData, error: authError } = await adminClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          tenant_id: tenantId,
        },
      },
    });

    if (authError || !authData.user) {
      if (authError?.message?.includes("already registered")) {
        console.log("⚠️  User already exists in auth. Using existing user...");
        // Try to sign in to get the user ID
        const { data: signInData } = await adminClient.auth.signInWithPassword({
          email,
          password,
        });
        
        if (!signInData?.user) {
          throw new Error("Could not sign in with existing credentials");
        }
        
        authData.user = signInData.user;
      } else {
        throw authError || new Error("Failed to create auth user");
      }
    }
    console.log("✅ Auth user created:", authData.user.id);

    // 2. Create user record
    console.log("2. Creating user record...");
    const userData: UserInsert = {
      id: authData.user.id,
      email,
      full_name: fullName,
      tenant_id: tenantId,
      role_id: defaultRole.id,
      plan: tenant.plan,
      status: "active",
    };

    const { data: user, error: userError } = await adminClient
      .from("users")
      .insert(userData)
      .select()
      .single();

    if (userError) {
      if (userError.code === "23505") {
        console.log("⚠️  User record already exists. Updating...");
        const { data: updatedUser } = await adminClient
          .from("users")
          .update(userData)
          .eq("id", authData.user.id)
          .select()
          .single();
        console.log("✅ User record updated");
        return updatedUser;
      }
      throw userError;
    }

    console.log("✅ User record created:", user.id);
    console.log("\n🎉 User created successfully!");
    console.log(`\nYou can now sign in at: http://localhost:3000/signin`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}\n`);

    return user;
  } catch (error) {
    console.error("❌ Error creating user:", error);
    throw error;
  }
}

createUserForTenant()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

