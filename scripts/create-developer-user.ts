#!/usr/bin/env tsx

/**
 * Create Developer Platform Admin User
 * Creates developer@tin.info with full platform access
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

const DEVELOPER_EMAIL = "developer@tin.info";
const DEVELOPER_PASSWORD = "88888888";
const DEVELOPER_FULL_NAME = "Developer User";

async function createDeveloperUser() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║   Create Developer Platform Admin         ║");
  console.log("╚════════════════════════════════════════════╝");
  console.log(`\n📡 Connected to: ${supabaseUrl}`);
  console.log(`👤 Target user: ${DEVELOPER_EMAIL}`);
  console.log(`🔑 Password: ${DEVELOPER_PASSWORD}`);
  
  try {
    // Step 1: Get Platform Admin role
    console.log("\n🔍 Getting Platform Admin role...");
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("*")
      .eq("name", "Platform Admin")
      .single();
    
    if (roleError || !role) {
      console.error("   ❌ Platform Admin role not found:", roleError?.message);
      throw new Error("Platform Admin role must exist");
    }
    
    console.log("   ✅ Platform Admin role found");
    console.log(`      - ID: ${role.id}`);
    
    // Step 2: Check if user already exists
    console.log(`\n🔍 Checking for existing user: ${DEVELOPER_EMAIL}`);
    
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error("   ❌ Error listing auth users:", authError.message);
      throw authError;
    }
    
    const authUser = authUsers.users.find((u) => u.email === DEVELOPER_EMAIL);
    
    if (authUser) {
      console.log("   ✅ Found in auth.users");
      console.log(`      - ID: ${authUser.id}`);
      
      // Check public.users
      const { data: publicUser, error: publicError } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();
      
      if (publicError) {
        console.log("   ⚠️  Not found in public.users, creating...");
        
        const { error: insertError } = await supabase
          .from("users")
          .insert({
            id: authUser.id,
            email: DEVELOPER_EMAIL,
            full_name: DEVELOPER_FULL_NAME,
            role_id: role.id,
            tenant_id: null,
            plan: "enterprise",
            status: "active",
          });
        
        if (insertError) throw insertError;
        console.log("   ✅ Public user record created");
      } else {
        console.log("   ✅ User already exists in public.users");
        console.log(`      - Role ID: ${publicUser.role_id}`);
        console.log(`      - Tenant ID: ${publicUser.tenant_id || "NULL (Platform Admin)"}`);
      }
    } else {
      console.log("   ℹ️  User does not exist, creating...");
      
      // Create auth user
      console.log("\n🔨 Creating auth user...");
      const { data: authData, error: authCreateError } = await supabase.auth.admin.createUser({
        email: DEVELOPER_EMAIL,
        password: DEVELOPER_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: DEVELOPER_FULL_NAME,
        },
      });
      
      if (authCreateError || !authData.user) {
        console.error("   ❌ Error creating auth user:", authCreateError?.message);
        throw authCreateError;
      }
      
      console.log("   ✅ Auth user created");
      console.log(`      - ID: ${authData.user.id}`);
      
      // Create public.users record
      console.log("\n🔨 Creating public.users record...");
      const { error: insertError } = await supabase
        .from("users")
        .insert({
          id: authData.user.id,
          email: DEVELOPER_EMAIL,
          full_name: DEVELOPER_FULL_NAME,
          role_id: role.id,
          tenant_id: null,
          plan: "enterprise",
          status: "active",
        });
      
      if (insertError) {
        console.error("   ❌ Error creating public.users record:", insertError.message);
        // Clean up auth user
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw insertError;
      }
      
      console.log("   ✅ Public user record created");
    }
    
    // Final verification
    console.log("\n═══════════════════════════════════════════");
    console.log("📋 FINAL USER STATUS");
    console.log("═══════════════════════════════════════════");
    
    const { data: finalAuthUsers } = await supabase.auth.admin.listUsers();
    const finalAuthUser = finalAuthUsers?.users.find((u) => u.email === DEVELOPER_EMAIL);
    
    if (finalAuthUser) {
      const { data: finalPublicUser } = await supabase
        .from("users")
        .select(`
          *,
          roles:role_id (
            name,
            coverage
          )
        `)
        .eq("id", finalAuthUser.id)
        .single();
      
      console.log("\n✅ Developer Platform Admin is ready to use:");
      console.log(`   📧 Email: ${DEVELOPER_EMAIL}`);
      console.log(`   🔑 Password: ${DEVELOPER_PASSWORD}`);
      console.log(`   🎭 Role: ${(finalPublicUser?.roles as any)?.name}`);
      console.log(`   🏢 Tenant: ${finalPublicUser?.tenant_id || "NULL (System-level)"}`);
      console.log(`   📊 Status: ${finalPublicUser?.status}`);
    }
    
    console.log("\n✅ Setup complete!\n");
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

createDeveloperUser();
