/**
 * Script to create user account for gene@velocitypartners.info
 * Run with: npx tsx scripts/create-gene-account.ts
 * 
 * Requires environment variables:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

async function createGeneAccount() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
  
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const email = "gene@velocitypartners.info";
  const fullName = "Gene";
  const password = "changeme123"; // User should change this

  console.log(`\n📋 Creating account for: ${email}\n`);

  try {
    // 1. Create auth user using admin API
    console.log("1. Creating Supabase Auth user...");
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
      },
    });

    if (authError || !authData.user) {
      if (authError?.message?.includes("already registered") || authError?.message?.includes("already exists")) {
        console.log("⚠️  User already exists in auth. Fetching existing user...");
        // Get existing user
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === email);
        if (!existingUser) {
          throw new Error("Could not find existing user");
        }
        authData.user = existingUser;
      } else {
        throw authError || new Error("Failed to create auth user");
      }
    }
    console.log("✅ Auth user created/found:", authData.user.id);

    // 2. Get or create a tenant for this user
    console.log("2. Checking for tenant...");
    let tenantId: string | null = null;
    
    // Check if user already has a tenant
    const { data: existingUser } = await adminClient
      .from("users")
      .select("tenant_id")
      .eq("id", authData.user.id)
      .single();
    
    if (existingUser?.tenant_id) {
      tenantId = existingUser.tenant_id;
      console.log("✅ Found existing tenant:", tenantId);
    } else {
      // Create a tenant for this user
      const tenantDomain = email.split("@")[1].replace(".", "-");
      const tenantName = "Velocity Partners";
      
      const { data: tenant, error: tenantError } = await adminClient
        .from("tenants")
        .insert({
          name: tenantName,
          domain: tenantDomain,
          plan: "starter",
          region: "us-east-1",
          status: "active",
        })
        .select()
        .single();
      
      if (tenantError || !tenant) {
        // Try to find existing tenant
        const { data: existingTenant } = await adminClient
          .from("tenants")
          .select("id")
          .eq("domain", tenantDomain)
          .single();
        
        if (existingTenant) {
          tenantId = existingTenant.id;
          console.log("✅ Found existing tenant:", tenantId);
        } else {
          throw tenantError || new Error("Failed to create tenant");
        }
      } else {
        tenantId = tenant.id;
        console.log("✅ Created tenant:", tenantId);
      }
    }

    // 3. Get Workspace Admin role (closest to Organization Admin)
    console.log("3. Getting role...");
    const { data: role, error: roleError } = await adminClient
      .from("roles")
      .select("id, name")
      .eq("name", "Workspace Admin")
      .single();

    if (roleError || !role) {
      throw roleError || new Error("Workspace Admin role not found");
    }
    console.log("✅ Found role:", role.name);

    // 4. Create or update user record
    console.log("4. Creating/updating user record...");
    const userData: UserInsert = {
      id: authData.user.id,
      email,
      full_name: fullName,
      tenant_id: tenantId,
      role_id: role.id,
      plan: "starter",
      status: "active",
    };

    const { data: user, error: userError } = await adminClient
      .from("users")
      .upsert(userData, { onConflict: "id" })
      .select()
      .single();

    if (userError) {
      throw userError;
    }

    console.log("✅ User record created/updated:", user.id);
    console.log("\n🎉 Account created successfully!");
    console.log(`\nYou can now sign in at: http://localhost:3000/signin`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`\n⚠️  Please change the password after first login!\n`);

    return user;
  } catch (error) {
    console.error("❌ Error creating account:", error);
    throw error;
  }
}

createGeneAccount()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

