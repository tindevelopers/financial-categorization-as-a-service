#!/usr/bin/env tsx
/**
 * Test Script: Tenant OAuth Credentials Functions
 * Tests all RPC functions and API routes with remote Supabase database
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<any>): Promise<void> {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    const result = await fn();
    results.push({ name, passed: true, details: result });
    console.log(`✅ PASSED: ${name}`);
    if (result && typeof result === 'object') {
      console.log(`   Details:`, JSON.stringify(result, null, 2).substring(0, 200));
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMessage });
    console.log(`❌ FAILED: ${name}`);
    console.log(`   Error: ${errorMessage}`);
  }
}

async function main() {
  console.log("🚀 Testing Tenant OAuth Credentials Functions");
  console.log("=".repeat(60));
  console.log(`Supabase URL: ${SUPABASE_URL}`);

  // Test 1: Check if table exists
  await test("Table exists", async () => {
    const { data, error } = await supabase
      .from("tenant_oauth_credentials")
      .select("id")
      .limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned, which is OK
      throw error;
    }
    return { table_exists: true };
  });

  // Test 2: Get a tenant ID for testing
  let testTenantId: string | null = null;
  await test("Get test tenant", async () => {
    const { data, error } = await supabase
      .from("tenants")
      .select("id")
      .limit(1)
      .single();
    
    if (error) throw error;
    testTenantId = data?.id || null;
    return { tenant_id: testTenantId };
  });

  if (!testTenantId) {
    console.log("\n⚠️  No tenant found. Creating a test tenant...");
    await test("Create test tenant", async () => {
      const { data, error } = await supabase
        .from("tenants")
        .insert({
          name: "Test Tenant",
          domain: `test-${Date.now()}.example.com`,
          status: "active",
          plan: "free",
          region: "us-east-1",
        })
        .select("id")
        .single();
      
      if (error) throw error;
      testTenantId = data?.id || null;
      return { tenant_id: testTenantId };
    });
  }

  if (!testTenantId) {
    console.log("\n❌ Cannot proceed without a tenant ID");
    process.exit(1);
  }

  console.log(`\n📋 Using test tenant ID: ${testTenantId}`);

  // Test 3: Test get_tenant_oauth_credential_metadata function
  await test("get_tenant_oauth_credential_metadata (no credentials)", async () => {
    const { data, error } = await supabase.rpc(
      "get_tenant_oauth_credential_metadata",
      {
        p_tenant_id: testTenantId,
        p_provider: "google",
        p_credential_type: "individual",
      }
    );
    
    if (error) throw error;
    return { result: data };
  });

  // Test 4: Test get_best_tenant_oauth_credentials function
  await test("get_best_tenant_oauth_credentials (no credentials)", async () => {
    const { data, error } = await supabase.rpc(
      "get_best_tenant_oauth_credentials",
      {
        p_tenant_id: testTenantId,
        p_provider: "google",
        p_credential_type: "individual",
      }
    );
    
    if (error) throw error;
    return { result: data };
  });

  // Test 5: Test list_tenant_oauth_credentials function
  await test("list_tenant_oauth_credentials (empty)", async () => {
    const { data, error } = await supabase.rpc("list_tenant_oauth_credentials", {
      p_tenant_id: testTenantId,
    });
    
    if (error) throw error;
    return { count: data?.length || 0, result: data };
  });

  // Test 6: Test save_tenant_oauth_credentials function (with test secret names)
  await test("save_tenant_oauth_credentials (test metadata)", async () => {
    const secretPrefix = `TENANT_${testTenantId.toUpperCase().replace(/-/g, "_")}_GOOGLE_INDIVIDUAL`;
    const clientIdSecretName = `${secretPrefix}_CLIENT_ID`;
    const clientSecretSecretName = `${secretPrefix}_CLIENT_SECRET`;

    const { data, error } = await supabase.rpc(
      "save_tenant_oauth_credentials",
      {
        p_tenant_id: testTenantId,
        p_provider: "google",
        p_credential_type: "individual",
        p_client_id_secret_name: clientIdSecretName,
        p_client_secret_secret_name: clientSecretSecretName,
        p_service_account_email: null,
        p_service_account_secret_name: null,
        p_redirect_uri: "https://example.com/callback",
      }
    );
    
    if (error) throw error;
    return { credential_id: data };
  });

  // Test 7: Test get_tenant_oauth_credential_metadata function (with credentials)
  await test("get_tenant_oauth_credential_metadata (with credentials)", async () => {
    const { data, error } = await supabase.rpc(
      "get_tenant_oauth_credential_metadata",
      {
        p_tenant_id: testTenantId,
        p_provider: "google",
        p_credential_type: "individual",
      }
    );
    
    if (error) throw error;
    return { found: data && data.length > 0, result: data };
  });

  // Test 8: Test list_tenant_oauth_credentials function (with credentials)
  await test("list_tenant_oauth_credentials (with credentials)", async () => {
    const { data, error } = await supabase.rpc("list_tenant_oauth_credentials", {
      p_tenant_id: testTenantId,
    });
    
    if (error) throw error;
    return { count: data?.length || 0, credentials: data };
  });

  // Test 9: Test delete_tenant_oauth_credentials function
  await test("delete_tenant_oauth_credentials", async () => {
    const { data, error } = await supabase.rpc(
      "delete_tenant_oauth_credentials",
      {
        p_tenant_id: testTenantId,
        p_provider: "google",
        p_credential_type: "individual",
      }
    );
    
    if (error) throw error;
    return { deleted: data };
  });

  // Test 10: Verify deletion
  await test("Verify credentials deleted", async () => {
    const { data, error } = await supabase.rpc(
      "get_tenant_oauth_credential_metadata",
      {
        p_tenant_id: testTenantId,
        p_provider: "google",
        p_credential_type: "individual",
      }
    );
    
    if (error) throw error;
    const stillActive = data?.some((c: any) => c.is_active === true) || false;
    return { still_active: stillActive, should_be_false: !stillActive };
  });

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Test Summary");
  console.log("=".repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${results.length}`);
  
  if (failed > 0) {
    console.log("\n❌ Failed Tests:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }
  
  console.log("\n" + "=".repeat(60));
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

