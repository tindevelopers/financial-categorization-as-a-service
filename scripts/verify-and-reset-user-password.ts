#!/usr/bin/env tsx

/**
 * Verify and Reset User Password
 * Checks if user exists and resets password to 88888888
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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const EMAIL = "gene@tin.info";
const PASSWORD = "88888888";

async function verifyAndResetPassword() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║   Verify and Reset User Password          ║");
  console.log("╚════════════════════════════════════════════╝");
  console.log(`\n📡 Connected to: ${supabaseUrl}`);
  console.log(`👤 User: ${EMAIL}`);
  console.log(`🔑 New Password: ${PASSWORD}`);
  
  try {
    // Step 1: List all users to find the one we need
    console.log("\n🔍 Searching for user in auth.users...");
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error("   ❌ Error listing users:", listError.message);
      throw listError;
    }
    
    const user = authUsers.users.find((u) => u.email === EMAIL);
    
    if (!user) {
      console.error(`   ❌ User ${EMAIL} not found in auth.users`);
      console.log("\n   Available users:");
      authUsers.users.forEach((u) => {
        console.log(`      - ${u.email} (${u.id})`);
      });
      throw new Error(`User ${EMAIL} not found`);
    }
    
    console.log("   ✅ User found in auth.users");
    console.log(`      - ID: ${user.id}`);
    console.log(`      - Email: ${user.email}`);
    console.log(`      - Email Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
    console.log(`      - Created: ${user.created_at}`);
    
    // Step 2: Update password using admin API
    console.log(`\n🔨 Resetting password to: ${PASSWORD}`);
    
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password: PASSWORD,
        email_confirm: true, // Ensure email is confirmed
      }
    );
    
    if (updateError || !updatedUser.user) {
      console.error("   ❌ Error updating password:", updateError?.message);
      throw updateError || new Error("Failed to update password");
    }
    
    console.log("   ✅ Password updated successfully");
    console.log(`      - User ID: ${updatedUser.user.id}`);
    console.log(`      - Email: ${updatedUser.user.email}`);
    
    // Step 3: Verify user in public.users
    console.log("\n🔍 Verifying user in public.users...");
    const { data: publicUser, error: publicError } = await supabase
      .from("users")
      .select(`
        *,
        roles:role_id (name, coverage),
        tenants:tenant_id (name, domain)
      `)
      .eq("id", user.id)
      .single();
    
    if (publicError) {
      console.error("   ⚠️  Error fetching public.users record:", publicError.message);
    } else if (publicUser) {
      console.log("   ✅ User found in public.users");
      console.log(`      - Role: ${(publicUser.roles as any)?.name}`);
      console.log(`      - Tenant: ${(publicUser.tenants as any)?.name || "NULL"}`);
      console.log(`      - Status: ${publicUser.status}`);
    }
    
    // Step 4: Test authentication
    console.log("\n🧪 Testing authentication...");
    const testClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    
    const { data: testAuth, error: testError } = await testClient.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    });
    
    if (testError || !testAuth.user) {
      console.error("   ❌ Authentication test failed:", testError?.message);
      throw testError || new Error("Authentication test failed");
    }
    
    console.log("   ✅ Authentication test successful!");
    console.log(`      - User ID: ${testAuth.user.id}`);
    console.log(`      - Email: ${testAuth.user.email}`);
    
    // Clean up test session
    await testClient.auth.signOut();
    
    console.log("\n═══════════════════════════════════════════");
    console.log("✅ PASSWORD RESET COMPLETE");
    console.log("═══════════════════════════════════════════");
    console.log(`\n📧 Email: ${EMAIL}`);
    console.log(`🔑 Password: ${PASSWORD}`);
    console.log(`\n✅ You can now sign in with these credentials!\n`);
    
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

verifyAndResetPassword();


