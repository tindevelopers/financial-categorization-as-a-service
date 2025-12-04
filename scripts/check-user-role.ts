#!/usr/bin/env tsx
/**
 * Check user role and RLS function
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/types";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load environment variables
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function checkUserRole() {
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log("🔍 Checking user role for: systemadmin@tin.info\n");

  // 1. Check if user exists
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select(`
      id,
      email,
      full_name,
      role_id,
      roles:role_id (
        id,
        name,
        description
      )
    `)
    .eq("email", "systemadmin@tin.info")
    .single();

  if (usersError) {
    console.error("❌ Error fetching user:", usersError);
    return;
  }

  if (!users) {
    console.error("❌ User not found");
    return;
  }

  console.log("✅ User found:");
  console.log(`   ID: ${users.id}`);
  console.log(`   Email: ${users.email}`);
  console.log(`   Name: ${users.full_name}`);
  console.log(`   Role ID: ${users.role_id}`);
  console.log(`   Role Name: ${(users.roles as any)?.name || "None"}`);
  console.log("");

  // 2. Test RLS function
  console.log("🔍 Testing is_platform_admin() function...");
  const { data: functionTest, error: functionError } = await supabase.rpc("is_platform_admin");

  if (functionError) {
    console.error("❌ Error calling is_platform_admin():", functionError);
  } else {
    console.log(`   Function result: ${functionTest}`);
  }
  console.log("");

  // 3. Test tenant access
  console.log("🔍 Testing tenant access...");
  const { data: tenants, error: tenantsError } = await supabase
    .from("tenants")
    .select("*");

  if (tenantsError) {
    console.error("❌ Error fetching tenants:", tenantsError);
    console.error("   Code:", tenantsError.code);
    console.error("   Message:", tenantsError.message);
    console.error("   Details:", tenantsError.details);
    console.error("   Hint:", tenantsError.hint);
  } else {
    console.log(`✅ Can access ${tenants?.length || 0} tenants`);
    if (tenants && tenants.length > 0) {
      console.log("   Tenants:");
      tenants.forEach((t) => {
        console.log(`     - ${t.name} (${t.domain})`);
      });
    }
  }
}

checkUserRole().catch(console.error);

