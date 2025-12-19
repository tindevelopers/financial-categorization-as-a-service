#!/usr/bin/env tsx

/**
 * Create Platform Admin User
 * Creates systemadmin@tin.info with full platform access
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
  console.error("\n💡 Get these from: https://supabase.com/dashboard/project/firwcvlikjltikdrmejq/settings/api");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const ADMIN_EMAIL = "systemadmin@tin.info";
const ADMIN_PASSWORD = "88888888";
const ADMIN_FULL_NAME = "System Administrator";

async function ensurePlatformAdminRole() {
  console.log("\n🔍 Checking Platform Admin role...");
  
  const { data: role, error } = await supabase
    .from("roles")
    .select("*")
    .eq("name", "Platform Admin")
    .single();
  
  if (error) {
    if (error.code === "PGRST116") {
      console.log("   ⚠️  Platform Admin role not found, creating...");
      
      const { data: newRole, error: createError } = await supabase
        .from("roles")
        .insert({
          name: "Platform Admin",
          description: "Full system administrator with access to all tenants and system settings",
          coverage: "platform",
          permissions: ["*"],
          gradient: "bg-gradient-to-r from-purple-600 to-blue-600",
          max_seats: 0,
          current_seats: 0,
        })
        .select()
        .single();
      
      if (createError) {
        console.error("   ❌ Failed to create Platform Admin role:", createError.message);
        throw createError;
      }
      
      console.log("   ✅ Platform Admin role created");
      return newRole;
    }
    throw error;
  }
  
  console.log("   ✅ Platform Admin role exists");
  console.log(`      - ID: ${role.id}`);
  console.log(`      - Coverage: ${role.coverage}`);
  
  return role;
}

async function checkExistingUser() {
  console.log(`\n🔍 Checking for existing user: ${ADMIN_EMAIL}`);
  
  // Check auth.users
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error("   ❌ Error listing auth users:", authError.message);
    throw authError;
  }
  
  const authUser = authUsers.users.find((u) => u.email === ADMIN_EMAIL);
  
  if (authUser) {
    console.log("   ✅ Found in auth.users");
    console.log(`      - ID: ${authUser.id}`);
    console.log(`      - Created: ${authUser.created_at}`);
    
    // Check public.users
    const { data: publicUser, error: publicError } = await supabase
      .from("users")
      .select(`
        *,
        roles:role_id (
          name,
          coverage
        )
      `)
      .eq("id", authUser.id)
      .single();
    
    if (publicError) {
      console.log("   ⚠️  Not found in public.users table");
      return { authUser, publicUser: null };
    }
    
    console.log("   ✅ Found in public.users");
    console.log(`      - Role: ${(publicUser.roles as any)?.name || "None"}`);
    console.log(`      - Tenant ID: ${publicUser.tenant_id || "NULL (Platform Admin)"}`);
    
    return { authUser, publicUser };
  }
  
  console.log("   ℹ️  User does not exist");
  return null;
}

async function createPlatformAdmin(roleId: string) {
  console.log(`\n🔨 Creating Platform Admin: ${ADMIN_EMAIL}`);
  
  // Step 1: Create auth user
  console.log("   Step 1: Creating auth user...");
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      full_name: ADMIN_FULL_NAME,
    },
  });
  
  if (authError) {
    console.error("   ❌ Error creating auth user:", authError.message);
    throw authError;
  }
  
  if (!authData.user) {
    throw new Error("Auth user created but no user data returned");
  }
  
  console.log("   ✅ Auth user created");
  console.log(`      - ID: ${authData.user.id}`);
  console.log(`      - Email: ${authData.user.email}`);
  
  // Step 2: Create public.users record
  console.log("   Step 2: Creating public.users record...");
  const { data: publicUser, error: publicError } = await supabase
    .from("users")
    .insert({
      id: authData.user.id,
      email: ADMIN_EMAIL,
      full_name: ADMIN_FULL_NAME,
      role_id: roleId,
      tenant_id: null, // NULL for Platform Admin (system-level access)
      plan: "enterprise",
      status: "active",
    })
    .select()
    .single();
  
  if (publicError) {
    console.error("   ❌ Error creating public.users record:", publicError.message);
    
    // Try to clean up auth user
    console.log("   🧹 Cleaning up auth user...");
    await supabase.auth.admin.deleteUser(authData.user.id);
    
    throw publicError;
  }
  
  console.log("   ✅ Public user record created");
  console.log(`      - User ID: ${publicUser.id}`);
  console.log(`      - Role ID: ${publicUser.role_id}`);
  console.log(`      - Tenant ID: ${publicUser.tenant_id || "NULL (Platform Admin)"}`);
  
  return { authUser: authData.user, publicUser };
}

async function updateExistingUser(userId: string, roleId: string) {
  console.log(`\n🔄 Updating existing user to Platform Admin...`);
  
  const { data: publicUser, error: publicError } = await supabase
    .from("users")
    .update({
      role_id: roleId,
      tenant_id: null, // NULL for Platform Admin
      status: "active",
      full_name: ADMIN_FULL_NAME,
    })
    .eq("id", userId)
    .select()
    .single();
  
  if (publicError) {
    console.error("   ❌ Error updating user:", publicError.message);
    throw publicError;
  }
  
  console.log("   ✅ User updated successfully");
  console.log(`      - Role ID: ${publicUser.role_id}`);
  console.log(`      - Tenant ID: ${publicUser.tenant_id || "NULL (Platform Admin)"}`);
  
  return publicUser;
}

async function main() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║   Create Platform Admin User               ║");
  console.log("╚════════════════════════════════════════════╝");
  console.log(`\n📡 Connected to: ${supabaseUrl}`);
  console.log(`👤 Target user: ${ADMIN_EMAIL}`);
  console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
  
  try {
    // Step 1: Ensure Platform Admin role exists
    const role = await ensurePlatformAdminRole();
    
    // Step 2: Check if user already exists
    const existing = await checkExistingUser();
    
    if (existing) {
      if (existing.publicUser) {
        const currentRole = (existing.publicUser.roles as any)?.name;
        const currentTenantId = existing.publicUser.tenant_id;
        
        if (currentRole === "Platform Admin" && currentTenantId === null) {
          console.log("\n✅ User is already a Platform Admin!");
          console.log("   No changes needed.");
        } else {
          console.log(`\n⚠️  User exists but is not a Platform Admin`);
          console.log(`   Current role: ${currentRole || "None"}`);
          console.log(`   Current tenant: ${currentTenantId || "NULL"}`);
          console.log(`\n   Updating to Platform Admin...`);
          
          await updateExistingUser(existing.authUser.id, role.id);
          console.log("\n✅ User updated to Platform Admin!");
        }
      } else {
        console.log("\n⚠️  Auth user exists but missing public.users record");
        console.log("   Creating public.users record...");
        
        const { error } = await supabase
          .from("users")
          .insert({
            id: existing.authUser.id,
            email: ADMIN_EMAIL,
            full_name: ADMIN_FULL_NAME,
            role_id: role.id,
            tenant_id: null,
            plan: "enterprise",
            status: "active",
          });
        
        if (error) throw error;
        console.log("   ✅ Public user record created");
      }
    } else {
      // Create new user
      await createPlatformAdmin(role.id);
      console.log("\n🎉 Platform Admin created successfully!");
    }
    
    // Final verification
    console.log("\n═══════════════════════════════════════════");
    console.log("📋 FINAL USER STATUS");
    console.log("═══════════════════════════════════════════");
    
    const final = await checkExistingUser();
    if (final?.publicUser) {
      console.log("\n✅ Platform Admin is ready to use:");
      console.log(`   📧 Email: ${ADMIN_EMAIL}`);
      console.log(`   🔑 Password: ${ADMIN_PASSWORD}`);
      console.log(`   🎭 Role: ${(final.publicUser.roles as any)?.name}`);
      console.log(`   🏢 Tenant: ${final.publicUser.tenant_id || "NULL (System-level)"}`);
      console.log(`   📊 Status: ${final.publicUser.status}`);
    }
    
    console.log("\n✅ Setup complete!\n");
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

main();
