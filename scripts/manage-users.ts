#!/usr/bin/env tsx

/**
 * User Management Script
 * Checks and creates users in the database
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Missing required environment variables");
  console.error("   NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error("   SUPABASE_SERVICE_ROLE_KEY:", serviceRoleKey ? "✓" : "✗");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkUser(email: string) {
  console.log(`\n🔍 Checking user: ${email}`);
  
  // Check auth.users
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error("   ❌ Error listing auth users:", authError.message);
    return null;
  }
  
  const authUser = authUsers.users.find((u) => u.email === email);
  
  if (!authUser) {
    console.log(`   ❌ User not found in auth.users`);
    return null;
  }
  
  console.log(`   ✅ Found in auth.users`);
  console.log(`      - ID: ${authUser.id}`);
  console.log(`      - Email: ${authUser.email}`);
  console.log(`      - Created: ${authUser.created_at}`);
  
  // Check public.users
  const { data: publicUser, error: publicError } = await supabase
    .from("users")
    .select(`
      *,
      roles:role_id (
        name,
        coverage
      ),
      tenants:tenant_id (
        name,
        domain
      )
    `)
    .eq("id", authUser.id)
    .single();
  
  if (publicError) {
    console.log(`   ⚠️  Not found in public.users table`);
    return { authUser, publicUser: null };
  }
  
  console.log(`   ✅ Found in public.users`);
  console.log(`      - Full Name: ${publicUser.full_name}`);
  console.log(`      - Role: ${(publicUser.roles as any)?.name || "None"}`);
  console.log(`      - Coverage: ${(publicUser.roles as any)?.coverage || "None"}`);
  console.log(`      - Tenant: ${(publicUser.tenants as any)?.name || "NULL (Platform Admin)"}`);
  console.log(`      - Status: ${publicUser.status}`);
  
  return { authUser, publicUser };
}

async function createUser(email: string, password: string, fullName: string, roleName: string = "Platform Admin") {
  console.log(`\n🔨 Creating user: ${email}`);
  
  // Check if user already exists
  const existing = await checkUser(email);
  if (existing?.authUser) {
    console.log(`   ⚠️  User already exists, skipping creation`);
    return;
  }
  
  // Get role ID
  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id, name, coverage")
    .eq("name", roleName)
    .single();
  
  if (roleError || !role) {
    console.error(`   ❌ Role "${roleName}" not found:`, roleError?.message);
    return;
  }
  
  console.log(`   ✓ Using role: ${role.name} (${role.coverage})`);
  
  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      full_name: fullName,
    },
  });
  
  if (authError || !authData.user) {
    console.error(`   ❌ Error creating auth user:`, authError?.message);
    return;
  }
  
  console.log(`   ✅ Created auth user`);
  console.log(`      - ID: ${authData.user.id}`);
  
  // Create public.users record
  const { data: publicUser, error: publicError } = await supabase
    .from("users")
    .insert({
      id: authData.user.id,
      email,
      full_name: fullName,
      role_id: role.id,
      tenant_id: null, // NULL for Platform Admin
      plan: "enterprise",
      status: "active",
    })
    .select()
    .single();
  
  if (publicError) {
    console.error(`   ❌ Error creating public.users record:`, publicError.message);
    // Try to clean up auth user
    await supabase.auth.admin.deleteUser(authData.user.id);
    return;
  }
  
  console.log(`   ✅ Created public.users record`);
  console.log(`   🎉 User ${email} created successfully!`);
}

async function main() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║     User Management Script                 ║");
  console.log("╚════════════════════════════════════════════╝");
  console.log(`\n📡 Connected to: ${supabaseUrl}`);
  
  // Check existing admin user
  await checkUser("systemadmin@tin.info");
  
  // Create developer user
  await createUser("developer@tin.info", "88888888", "Developer User", "Platform Admin");
  
  // Verify both users
  console.log("\n\n═══════════════════════════════════════════");
  console.log("📋 FINAL USER LIST");
  console.log("═══════════════════════════════════════════");
  
  await checkUser("systemadmin@tin.info");
  await checkUser("developer@tin.info");
  
  console.log("\n✅ User management complete!\n");
}

main().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});


