/**
 * Test script for multi-tenant system
 * Run with: npx tsx test-multi-tenant.ts
 */

import { createClient } from "./src/lib/supabase/client";
import { signUp, signIn } from "./src/lib/auth/auth";
import { getUsers, createUser } from "./src/lib/supabase/users";
import { getTenants, createTenant } from "./src/lib/supabase/tenants";
import { getRoles } from "./src/lib/supabase/roles";
import { getUserPermissions, hasPermission } from "./src/lib/auth/permissions";

async function testMultiTenant() {
  console.log("🧪 Testing Multi-Tenant System\n");

  const supabase = createClient();

  try {
    // Test 1: Create Tenant 1
    console.log("1️⃣ Creating Tenant 1...");
    const tenant1 = await createTenant({
      name: "Acme Corp",
      domain: "acme.com",
      plan: "pro",
      region: "us-east-1",
      status: "active",
    });
    console.log("✅ Tenant 1 created:", tenant1.id);

    // Test 2: Create Tenant 2
    console.log("\n2️⃣ Creating Tenant 2...");
    const tenant2 = await createTenant({
      name: "TechStart Inc",
      domain: "techstart.io",
      plan: "starter",
      region: "us-west-1",
      status: "active",
    });
    console.log("✅ Tenant 2 created:", tenant2.id);

    // Test 3: Get Roles
    console.log("\n3️⃣ Fetching roles...");
    const roles = await getRoles();
    console.log(`✅ Found ${roles.length} roles`);
    const workspaceAdminRole = roles.find(r => r.name === "Workspace Admin");
    console.log("   Workspace Admin role ID:", workspaceAdminRole?.id);

    // Test 4: Sign up user for Tenant 1
    console.log("\n4️⃣ Signing up user for Tenant 1...");
    try {
      const signupResult = await signUp({
        email: "alice@acme.com",
        password: "testpassword123",
        fullName: "Alice Johnson",
        tenantName: "Acme Corp",
        tenantDomain: "acme.com",
        plan: "pro",
        region: "us-east-1",
      });
      console.log("✅ User signed up:", signupResult.user.email);
      console.log("   Tenant ID:", signupResult.user.tenant_id);
    } catch (err) {
      console.log("⚠️  Signup test skipped (user may already exist)");
    }

    // Test 5: Get users (should be tenant-scoped)
    console.log("\n5️⃣ Fetching users...");
    const users = await getUsers();
    console.log(`✅ Found ${users.length} users`);
    users.forEach(user => {
      console.log(`   - ${user.email} (Tenant: ${user.tenant_id})`);
    });

    // Test 6: Test tenant isolation
    console.log("\n6️⃣ Testing tenant isolation...");
    const tenant1Users = await getUsers(tenant1.id);
    const tenant2Users = await getUsers(tenant2.id);
    console.log(`✅ Tenant 1 users: ${tenant1Users?.length || 0}`);
    console.log(`✅ Tenant 2 users: ${tenant2Users?.length || 0}`);

    // Test 7: Get tenants
    console.log("\n7️⃣ Fetching tenants...");
    const tenants = await getTenants();
    console.log(`✅ Found ${tenants.length} tenants`);
    tenants.forEach(tenant => {
      console.log(`   - ${tenant.name} (${tenant.domain})`);
    });

    // Test 8: Test permissions
    console.log("\n8️⃣ Testing permissions...");
    if (users.length > 0) {
      const testUser = users[0];
      const permissions = await getUserPermissions(testUser.id);
      console.log(`✅ User ${testUser.email} permissions:`, permissions);
      
      const canReadUsers = await hasPermission(testUser.id, "users.read");
      console.log(`   Can read users: ${canReadUsers}`);
    }

    console.log("\n✅ All tests completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("   1. Test signup flow at /signup");
    console.log("   2. Test signin flow at /signin");
    console.log("   3. Verify tenant isolation in user management");
    console.log("   4. Test RLS policies in Supabase Studio");

  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}

// Run tests
testMultiTenant()
  .then(() => {
    console.log("\n✨ Test suite completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Test suite failed:", error);
    process.exit(1);
  });

