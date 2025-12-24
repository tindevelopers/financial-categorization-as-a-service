#!/usr/bin/env tsx
/**
 * Test script for categorization API endpoints
 * Tests that authentication is working correctly after the fix
 */

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  statusCode?: number;
  data?: any;
}

async function testCategorizationAPI() {
  console.log('🧪 Testing Categorization API Endpoints\n');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Supabase URL: ${SUPABASE_URL}\n`);

  const results: TestResult[] = [];

  // Test 1: Check if Supabase is configured
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase environment variables');
    console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  // Test 2: Create a test user session
  console.log('📝 Step 1: Creating test user session...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Try to sign in with test credentials (you may need to adjust these)
  const testEmail = process.env.TEST_EMAIL || 'test@example.com';
  const testPassword = process.env.TEST_PASSWORD || 'testpassword123';

  console.log(`   Attempting to sign in as: ${testEmail}`);
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (authError || !authData.session) {
    results.push({
      name: 'Authentication',
      passed: false,
      error: authError?.message || 'Failed to authenticate',
    });
    console.log(`   ❌ Authentication failed: ${authError?.message}`);
    console.log('\n💡 Tip: Create a test user first or set TEST_EMAIL and TEST_PASSWORD env vars');
    
    // Continue with unauthenticated test to show the 401 error
    console.log('\n📝 Testing unauthenticated request (should return 401)...');
    const unauthResponse = await fetch(`${API_BASE_URL}/api/categorization/jobs`);
    results.push({
      name: 'Unauthenticated Request',
      passed: unauthResponse.status === 401,
      statusCode: unauthResponse.status,
      error: unauthResponse.status === 401 ? undefined : `Expected 401, got ${unauthResponse.status}`,
    });
    
    printResults(results);
    process.exit(authError ? 1 : 0);
  }

  console.log(`   ✅ Authenticated as: ${authData.user.email}`);
  results.push({
    name: 'Authentication',
    passed: true,
    data: { userId: authData.user.id, email: authData.user.email },
  });

  // Test 3: Test /api/categorization/jobs endpoint
  console.log('\n📝 Step 2: Testing GET /api/categorization/jobs...');
  try {
    const response = await fetch(`${API_BASE_URL}/api/categorization/jobs`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token=${authData.session.access_token}`,
      },
      credentials: 'include',
    });

    const responseData = await response.json().catch(() => ({}));
    
    results.push({
      name: 'GET /api/categorization/jobs',
      passed: response.status === 200,
      statusCode: response.status,
      error: response.status !== 200 ? `Expected 200, got ${response.status}` : undefined,
      data: response.status === 200 ? responseData : undefined,
    });

    if (response.status === 200) {
      console.log(`   ✅ Success! Status: ${response.status}`);
      console.log(`   📊 Jobs returned: ${responseData.jobs?.length || 0}`);
    } else {
      console.log(`   ❌ Failed! Status: ${response.status}`);
      console.log(`   Error: ${JSON.stringify(responseData)}`);
    }
  } catch (error: any) {
    results.push({
      name: 'GET /api/categorization/jobs',
      passed: false,
      error: error.message,
    });
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 4: Test with proper cookie-based authentication
  console.log('\n📝 Step 3: Testing with cookie-based authentication...');
  try {
    // Create a cookie string from the session
    const cookieHeader = [
      `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token=${authData.session.access_token}`,
      `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token.0=${authData.session.refresh_token}`,
    ].join('; ');

    const response = await fetch(`${API_BASE_URL}/api/categorization/jobs`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      credentials: 'include',
    });

    const responseData = await response.json().catch(() => ({}));
    
    results.push({
      name: 'GET /api/categorization/jobs (with cookies)',
      passed: response.status === 200,
      statusCode: response.status,
      error: response.status !== 200 ? `Expected 200, got ${response.status}` : undefined,
      data: response.status === 200 ? responseData : undefined,
    });

    if (response.status === 200) {
      console.log(`   ✅ Success! Status: ${response.status}`);
    } else {
      console.log(`   ❌ Failed! Status: ${response.status}`);
      console.log(`   Error: ${JSON.stringify(responseData)}`);
    }
  } catch (error: any) {
    results.push({
      name: 'GET /api/categorization/jobs (with cookies)',
      passed: false,
      error: error.message,
    });
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 5: Test transactions endpoint (if we have a job ID)
  console.log('\n📝 Step 4: Testing GET /api/categorization/jobs/[jobId]/transactions...');
  try {
    // First get jobs to find a job ID
    const jobsResponse = await fetch(`${API_BASE_URL}/api/categorization/jobs`, {
      headers: {
        'Cookie': `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token=${authData.session.access_token}`,
      },
      credentials: 'include',
    });

    if (jobsResponse.status === 200) {
      const jobsData = await jobsResponse.json();
      const jobId = jobsData.jobs?.[0]?.id;

      if (jobId) {
        const txResponse = await fetch(`${API_BASE_URL}/api/categorization/jobs/${jobId}/transactions`, {
          headers: {
            'Cookie': `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token=${authData.session.access_token}`,
          },
          credentials: 'include',
        });

        const txData = await txResponse.json().catch(() => ({}));
        
        results.push({
          name: `GET /api/categorization/jobs/${jobId}/transactions`,
          passed: txResponse.status === 200,
          statusCode: txResponse.status,
          error: txResponse.status !== 200 ? `Expected 200, got ${txResponse.status}` : undefined,
          data: txResponse.status === 200 ? txData : undefined,
        });

        if (txResponse.status === 200) {
          console.log(`   ✅ Success! Status: ${txResponse.status}`);
          console.log(`   📊 Transactions returned: ${txData.transactions?.length || 0}`);
        } else {
          console.log(`   ❌ Failed! Status: ${txResponse.status}`);
        }
      } else {
        console.log(`   ⚠️  No jobs found, skipping transaction test`);
        results.push({
          name: 'GET /api/categorization/jobs/[jobId]/transactions',
          passed: true,
          error: 'Skipped - no jobs available',
        });
      }
    }
  } catch (error: any) {
    results.push({
      name: 'GET /api/categorization/jobs/[jobId]/transactions',
      passed: false,
      error: error.message,
    });
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Print summary
  printResults(results);

  // Exit with appropriate code
  const allPassed = results.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

function printResults(results: TestResult[]) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(60) + '\n');

  results.forEach((result, index) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} Test ${index + 1}: ${result.name}`);
    if (result.statusCode) {
      console.log(`   Status Code: ${result.statusCode}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.data && result.passed) {
      if (result.data.jobs) {
        console.log(`   Jobs: ${result.data.jobs.length}`);
      }
      if (result.data.transactions) {
        console.log(`   Transactions: ${result.data.transactions.length}`);
      }
    }
    console.log('');
  });

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`\n✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}\n`);
}

// Run the tests
testCategorizationAPI().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

