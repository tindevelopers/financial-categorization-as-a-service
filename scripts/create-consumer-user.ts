#!/usr/bin/env tsx

/**
 * Create Normal Consumer User
 * Creates gene@tin.info with their own tenant
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

const USER_EMAIL = "gene@tin.info";
const USER_PASSWORD = "88888888";
const USER_FULL_NAME = "Gene";
const TENANT_NAME = "Gene's Organization";
const TENANT_DOMAIN = "gene-org";

async function createConsumerUser() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║   Create Consumer User                     ║");
  console.log("╚════════════════════════════════════════════╝");
  console.log(`\n📡 Connected to: ${supabaseUrl}`);
  console.log(`👤 User: ${USER_EMAIL}`);
  console.log(`🔑 Password: ${USER_PASSWORD}`);
  console.log(`🏢 Tenant: ${TENANT_NAME} (${TENANT_DOMAIN})`);
  
  try {
    // Step 1: Get Organization Admin role
    console.log("\n🔍 Getting Organization Admin role...");
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("*")
      .eq("name", "Organization Admin")
      .single();
    
    if (roleError || !role) {
      console.error("   ❌ Organization Admin role not found:", roleError?.message);
      throw new Error("Organization Admin role must exist");
    }
    
    console.log("   ✅ Organization Admin role found");
    console.log(`      - ID: ${role.id}`);
    console.log(`      - Coverage: ${role.coverage}`);
    
    // Step 2: Check if user already exists
    console.log(`\n🔍 Checking for existing user: ${USER_EMAIL}`);
    
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error("   ❌ Error listing auth users:", authError.message);
      throw authError;
    }
    
    const existingAuthUser = authUsers.users.find((u) => u.email === USER_EMAIL);
    
    if (existingAuthUser) {
      console.log("   ✅ User already exists in auth.users");
      console.log(`      - ID: ${existingAuthUser.id}`);
      
      const { data: existingPublicUser } = await supabase
        .from("users")
        .select(`
          *,
          roles:role_id (name, coverage),
          tenants:tenant_id (name, domain)
        `)
        .eq("id", existingAuthUser.id)
        .single();
      
      if (existingPublicUser) {
        console.log("   ✅ User already exists in public.users");
        console.log(`      - Role: ${(existingPublicUser.roles as any)?.name}`);
        console.log(`      - Tenant: ${(existingPublicUser.tenants as any)?.name}`);
        console.log("\n✅ User already set up!");
        return;
      }
    }
    
    // Step 3: Check if tenant already exists
    console.log(`\n🔍 Checking for tenant: ${TENANT_DOMAIN}`);
    
    let tenant;
    const { data: existingTenant, error: tenantCheckError } = await supabase
      .from("tenants")
      .select("*")
      .eq("domain", TENANT_DOMAIN)
      .single();
    
    if (tenantCheckError && tenantCheckError.code !== "PGRST116") {
      console.error("   ⚠️  Error checking tenant:", tenantCheckError.message);
    }
    
    if (existingTenant) {
      console.log("   ✅ Tenant already exists");
      console.log(`      - ID: ${existingTenant.id}`);
      console.log(`      - Name: ${existingTenant.name}`);
      tenant = existingTenant;
    } else {
      console.log("   ℹ️  Tenant does not exist, creating...");
      
      const { data: newTenant, error: tenantCreateError } = await supabase
        .from("tenants")
        .insert({
          name: TENANT_NAME,
          domain: TENANT_DOMAIN,
          plan: "starter",
          region: "us-east-1",
          status: "active",
        })
        .select()
        .single();
      
      if (tenantCreateError || !newTenant) {
        console.error("   ❌ Error creating tenant:", tenantCreateError?.message);
        throw tenantCreateError;
      }
      
      console.log("   ✅ Tenant created");
      console.log(`      - ID: ${newTenant.id}`);
      console.log(`      - Name: ${newTenant.name}`);
      console.log(`      - Domain: ${newTenant.domain}`);
      tenant = newTenant;
    }
    
    // Step 4: Create auth user if needed
    let authUser = existingAuthUser;
    
    if (!authUser) {
      console.log(`\n🔨 Creating auth user: ${USER_EMAIL}`);
      
      const { data: authData, error: authCreateError } = await supabase.auth.admin.createUser({
        email: USER_EMAIL,
        password: USER_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: USER_FULL_NAME,
          tenant_id: tenant.id,
        },
      });
      
      if (authCreateError || !authData.user) {
        console.error("   ❌ Error creating auth user:", authCreateError?.message);
        throw authCreateError;
      }
      
      console.log("   ✅ Auth user created");
      console.log(`      - ID: ${authData.user.id}`);
      authUser = authData.user;
    }
    
    // Step 5: Create public.users record
    console.log("\n🔨 Creating public.users record...");
    
    const { data: publicUser, error: publicUserError } = await supabase
      .from("users")
      .insert({
        id: authUser.id,
        email: USER_EMAIL,
        full_name: USER_FULL_NAME,
        role_id: role.id,
        tenant_id: tenant.id, // Consumer users belong to their tenant
        plan: "starter",
        status: "active",
      })
      .select()
      .single();
    
    if (publicUserError) {
      console.error("   ❌ Error creating public.users record:", publicUserError.message);
      
      // Clean up auth user if we just created it
      if (!existingAuthUser) {
        console.log("   🧹 Cleaning up auth user...");
        await supabase.auth.admin.deleteUser(authUser.id);
      }
      
      throw publicUserError;
    }
    
    console.log("   ✅ Public user record created");
    console.log(`      - User ID: ${publicUser.id}`);
    console.log(`      - Tenant ID: ${publicUser.tenant_id}`);
    console.log(`      - Role ID: ${publicUser.role_id}`);
    
    // Final verification
    console.log("\n═══════════════════════════════════════════");
    console.log("📋 FINAL USER STATUS");
    console.log("═══════════════════════════════════════════");
    
    const { data: finalUser } = await supabase
      .from("users")
      .select(`
        *,
        roles:role_id (name, coverage),
        tenants:tenant_id (name, domain)
      `)
      .eq("id", authUser.id)
      .single();
    
    if (finalUser) {
      console.log("\n✅ Consumer User is ready to use:");
      console.log(`   📧 Email: ${USER_EMAIL}`);
      console.log(`   🔑 Password: ${USER_PASSWORD}`);
      console.log(`   👤 Full Name: ${finalUser.full_name}`);
      console.log(`   🎭 Role: ${(finalUser.roles as any)?.name}`);
      console.log(`   🏢 Tenant: ${(finalUser.tenants as any)?.name}`);
      console.log(`   🌐 Domain: ${(finalUser.tenants as any)?.domain}`);
      console.log(`   📊 Status: ${finalUser.status}`);
      console.log(`   💳 Plan: ${finalUser.plan}`);
    }
    
    console.log("\n✅ Setup complete!\n");
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

createConsumerUser();


