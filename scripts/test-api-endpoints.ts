#!/usr/bin/env tsx
/**
 * Test Script: API Endpoints for Tenant OAuth Credentials
 * Tests all API routes with authentication
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

if (!SUPABASE_URL) {
  console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL must be set");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || "");

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
      const preview = JSON.stringify(result, null, 2).substring(0, 300);
      console.log(`   Response: ${preview}${preview.length >= 300 ? '...' : ''}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMessage });
    console.log(`❌ FAILED: ${name}`);
    console.log(`   Error: ${errorMessage}`);
  }
}

async function getAuthToken(): Promise<string | null> {
  // Try to get a test user or create one
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = "TestPassword123!";
  
  try {
    // Try to sign up a test user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (signUpError && !signUpError.message.includes("already registered")) {
      // Try to sign in instead
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

      if (signInError) {
        console.log("⚠️  Could not authenticate test user. Some tests may fail.");
        return null;
      }

      return signInData.session?.access_token || null;
    }

    return signUpData.session?.access_token || null;
  } catch (error) {
    console.log("⚠️  Authentication skipped. Testing with service role.");
    return null;
  }
}

async function getTestTenantId(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("tenants")
      .select("id")
      .limit(1)
      .single();
    
    if (error || !data) {
      // Create a test tenant
      const { data: newTenant, error: createError } = await supabase
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
      
      if (createError) throw createError;
      return newTenant?.id || null;
    }
    
    return data.id;
  } catch (error) {
    console.error("Error getting test tenant:", error);
    return null;
  }
}

async function main() {
  console.log("🚀 Testing Tenant OAuth Credentials API Endpoints");
  console.log("=".repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);

  const authToken = await getAuthToken();
  const testTenantId = await getTestTenantId();

  if (!testTenantId) {
    console.log("\n❌ Cannot proceed without a tenant ID");
    process.exit(1);
  }

  console.log(`\n📋 Using test tenant ID: ${testTenantId}`);
  if (authToken) {
    console.log(`🔑 Authentication token obtained`);
  }

  // Test 1: GET /api/tenant/credentials/oauth (list credentials)
  await test("GET /api/tenant/credentials/oauth (list)", async () => {
    const url = `${BASE_URL}/api/tenant/credentials/oauth?tenant_id=${testTenantId}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, { headers });
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
    }
    
    return data;
  });

  // Test 2: GET /api/tenant/credentials/oauth (specific provider)
  await test("GET /api/tenant/credentials/oauth (google individual)", async () => {
    const url = `${BASE_URL}/api/tenant/credentials/oauth?tenant_id=${testTenantId}&provider=google&credential_type=individual`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, { headers });
    const data = await response.json();
    
    if (!response.ok && response.status !== 404) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
    }
    
    return data;
  });

  // Test 3: POST /api/tenant/credentials/test (test credentials)
  await test("POST /api/tenant/credentials/test", async () => {
    const url = `${BASE_URL}/api/tenant/credentials/test`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        tenant_id: testTenantId,
        provider: "google",
        credential_type: "individual",
      }),
    });
    
    const data = await response.json();
    
    // 404 is OK if no credentials exist
    if (!response.ok && response.status !== 404) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
    }
    
    return data;
  });

  // Test 4: Test RPC functions directly
  await test("RPC: get_tenant_oauth_credential_metadata", async () => {
    const { data, error } = await supabase.rpc(
      "get_tenant_oauth_credential_metadata",
      {
        p_tenant_id: testTenantId,
        p_provider: "google",
        p_credential_type: "individual",
      }
    );
    
    if (error) {
      // Check if it's a "function does not exist" error
      if (error.message.includes("does not exist") || error.code === "42883") {
        throw new Error("RPC function not found. Migrations may not be applied.");
      }
      throw error;
    }
    
    return { found: data && data.length > 0, count: data?.length || 0 };
  });

  await test("RPC: list_tenant_oauth_credentials", async () => {
    const { data, error } = await supabase.rpc("list_tenant_oauth_credentials", {
      p_tenant_id: testTenantId,
    });
    
    if (error) {
      if (error.message.includes("does not exist") || error.code === "42883") {
        throw new Error("RPC function not found. Migrations may not be applied.");
      }
      throw error;
    }
    
    return { count: data?.length || 0, credentials: data };
  });

  await test("RPC: get_best_tenant_oauth_credentials", async () => {
    const { data, error } = await supabase.rpc(
      "get_best_tenant_oauth_credentials",
      {
        p_tenant_id: testTenantId,
        p_provider: "google",
        p_credential_type: "individual",
      }
    );
    
    if (error) {
      if (error.message.includes("does not exist") || error.code === "42883") {
        throw new Error("RPC function not found. Migrations may not be applied.");
      }
      throw error;
    }
    
    return data;
  });

  // Test 5: Check if table exists
  await test("Database: tenant_oauth_credentials table exists", async () => {
    const { data, error } = await supabase
      .from("tenant_oauth_credentials")
      .select("id")
      .limit(1);
    
    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        throw new Error("Table does not exist. Migrations may not be applied.");
      }
      // PGRST116 is OK (no rows)
      if (error.code !== "PGRST116") {
        throw error;
      }
    }
    
    return { table_exists: true };
  });

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Test Summary");
  console.log("=".repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log("\n❌ Failed Tests:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}`);
      console.log(`     Error: ${r.error}`);
    });
  } else {
    console.log("\n🎉 All tests passed!");
  }
  
  console.log("\n" + "=".repeat(60));
  
  // Check if migrations need to be applied
  const migrationErrors = results.filter(r => 
    !r.passed && r.error?.includes("does not exist") || r.error?.includes("Migrations may not be applied")
  );
  
  if (migrationErrors.length > 0) {
    console.log("\n⚠️  IMPORTANT: Migrations may not be applied!");
    console.log("   Please apply migrations using:");
    console.log("   1. Supabase Dashboard > SQL Editor");
    console.log("   2. Or run: supabase db push --linked --include-all");
    console.log("   3. File: supabase/migrations/APPLY_TENANT_OAUTH_MIGRATIONS.sql");
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

