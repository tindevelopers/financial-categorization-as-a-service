#!/usr/bin/env tsx
/**
 * Grant Platform Admin role to a user
 * 
 * Usage:
 *   npx tsx scripts/grant-platform-admin.ts <user-email>
 *   npx tsx scripts/grant-platform-admin.ts <user-email>
 * 
 * Or run interactively to select from available users
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/types";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";

// Load environment variables from .env.local
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
let SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Try to get from supabase status if not in env
if (!SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const statusOutput = execSync("supabase status --json", { encoding: "utf-8" });
    const status = JSON.parse(statusOutput);
    SUPABASE_SERVICE_ROLE_KEY = status?.api?.service_role_key || "";
    
    if (SUPABASE_SERVICE_ROLE_KEY) {
      console.log("✅ Found service role key from supabase status");
    }
  } catch (err) {
    // Ignore if supabase status fails
  }
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY is not set");
  console.error("\n   Please add to .env.local:");
  console.error("   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key");
  console.error("\n   Or get it from: supabase status");
  process.exit(1);
}

async function grantPlatformAdmin(userEmail?: string) {
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Get Platform Admin role
    const { data: platformAdminRole, error: roleError } = await supabase
      .from("roles")
      .select("id, name")
      .eq("name", "Platform Admin")
      .single();

    if (roleError || !platformAdminRole) {
      console.error("❌ Error finding Platform Admin role:", roleError);
      console.error("   Make sure the roles table has a 'Platform Admin' role");
      process.exit(1);
    }

    console.log(`✅ Found Platform Admin role: ${platformAdminRole.id}`);

    // If email provided, use it; otherwise list users
    if (userEmail) {
      // Find user by email
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, email, full_name, role_id")
        .eq("email", userEmail)
        .single();

      if (userError || !user) {
        console.error(`❌ User not found: ${userEmail}`);
        console.error("   Error:", userError);
        process.exit(1);
      }

      // Update user role and set tenant_id to NULL for Platform Admins)
      const { error: updateError } = await supabase
        .from("users")
        .update({ 
          role_id: platformAdminRole.id,
          tenant_id: null  // Platform Admins are system-level, not tied to any tenant
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("❌ Error updating user role:", updateError);
        process.exit(1);
      }

      console.log(`\n✅ Successfully granted Platform Admin role to:`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.full_name}`);
      console.log(`   User ID: ${user.id}`);
      console.log(`   Previous role_id: ${user.role_id || "None"}`);
      console.log(`   Previous tenant_id: ${user.tenant_id || "None"}`);
      console.log(`   New role_id: ${platformAdminRole.id}`);
      console.log(`   New tenant_id: NULL (system-level)`);
      console.log(`\n🎉 User now has Platform Admin privileges!`);
      console.log(`   They can now view all tenants and manage the system.`);
      console.log(`   Note: Platform Admins are system-level users (tenant_id = NULL)`);
    } else {
      // List all users and let user select
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, email, full_name, role_id, roles:role_id(name)")
        .order("created_at", { ascending: false });

      if (usersError || !users || users.length === 0) {
        console.error("❌ No users found or error:", usersError);
        process.exit(1);
      }

      console.log("\n📋 Available users:\n");
      users.forEach((user, index) => {
        const roleName = (user.roles as any)?.name || "No role";
        const isAdmin = roleName === "Platform Admin" ? " 👑" : "";
        console.log(`${index + 1}. ${user.email} (${user.full_name}) - Current role: ${roleName}${isAdmin}`);
      });

      console.log("\n💡 To grant Platform Admin to a specific user, run:");
      console.log(`   npx tsx scripts/grant-platform-admin.ts <email>`);
      console.log("\n   Example:");
      if (users.length > 0) {
        console.log(`   npx tsx scripts/grant-platform-admin.ts ${users[0].email}`);
      }
    }
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  }
}

// Get email from command line args
const userEmail = process.argv[2];

grantPlatformAdmin(userEmail).catch(console.error);
