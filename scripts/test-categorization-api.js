#!/usr/bin/env node
/**
 * Test script for categorization API endpoints
 * Tests that authentication is working correctly after the fix
 */

// Load environment variables from .env.local if it exists
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (e) {
  // Ignore errors loading .env.local
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

async function testCategorizationAPI() {
  console.log('🧪 Testing Categorization API Endpoints\n');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Supabase URL: ${SUPABASE_URL}\n`);

  const results = [];

  // Check if Supabase is configured
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase environment variables');
    console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  // Test 1: Check if server is running
  console.log('📝 Test 1: Checking if server is running...');
  try {
    const healthCheck = await fetch(`${API_BASE_URL}/`, { method: 'HEAD' });
    if (!healthCheck.ok && healthCheck.status !== 404) {
      throw new Error(`Server not responding: ${healthCheck.status}`);
    }
    console.log(`   ✅ Server is running on ${API_BASE_URL}`);
  } catch (error) {
    console.log(`   ❌ Server check failed: ${error.message}`);
    console.log(`   💡 Make sure the dev server is running: pnpm dev:portal`);
    results.push({
      name: 'Server Check',
      passed: false,
      error: error.message,
    });
    printResults(results);
    process.exit(1);
  }

  // Test 2: Unauthenticated request (should return 401)
  console.log('\n📝 Test 2: Unauthenticated request (should return 401)...');
  try {
    // Make sure we don't send any cookies
    const response = await fetch(`${API_BASE_URL}/api/categorization/jobs`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'omit', // Explicitly don't send cookies
    });
    const data = await response.json().catch(() => ({}));
    
    const passed = response.status === 401;
    results.push({
      name: 'Unauthenticated Request',
      passed,
      statusCode: response.status,
      error: passed ? undefined : `Expected 401, got ${response.status}. Response: ${JSON.stringify(data)}`,
    });

    if (passed) {
      console.log(`   ✅ Correctly returned 401 (Unauthorized)`);
    } else {
      console.log(`   ⚠️  Got ${response.status} instead of 401`);
      console.log(`   Response: ${JSON.stringify(data)}`);
      console.log(`   Note: This might be expected if middleware allows unauthenticated requests`);
    }
  } catch (error) {
    results.push({
      name: 'Unauthenticated Request',
      passed: false,
      error: error.message,
    });
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 3: Authenticate with Supabase
  console.log('\n📝 Test 3: Authenticating with Supabase...');
  let session = null;
  try {
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    const authData = await authResponse.json();

    if (authResponse.ok && authData.access_token) {
      session = authData;
      results.push({
        name: 'Authentication',
        passed: true,
        data: { userId: authData.user?.id, email: authData.user?.email },
      });
      console.log(`   ✅ Authenticated as: ${authData.user?.email || TEST_EMAIL}`);
    } else {
      results.push({
        name: 'Authentication',
        passed: false,
        error: authData.error_description || 'Failed to authenticate',
      });
      console.log(`   ❌ Authentication failed: ${authData.error_description || 'Unknown error'}`);
      console.log('\n💡 Tip: Create a test user first or set TEST_EMAIL and TEST_PASSWORD env vars');
      console.log('   Example: TEST_EMAIL=your@email.com TEST_PASSWORD=yourpassword node scripts/test-categorization-api.js\n');
      
      printResults(results);
      process.exit(1);
    }
  } catch (error) {
    results.push({
      name: 'Authentication',
      passed: false,
      error: error.message,
    });
    console.log(`   ❌ Error: ${error.message}`);
    printResults(results);
    process.exit(1);
  }

  // Test 4: Authenticated request to /api/categorization/jobs
  console.log('\n📝 Test 4: GET /api/categorization/jobs (authenticated)...');
  try {
    // Use the session token in a cookie-like format
    // The middleware will read this from cookies
    const response = await fetch(`${API_BASE_URL}/api/categorization/jobs`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        // Also set as cookie for Next.js middleware
        'Cookie': `sb-access-token=${session.access_token}; sb-refresh-token=${session.refresh_token}`,
      },
      credentials: 'include',
    });

    const responseData = await response.json().catch(() => ({}));
    
    const passed = response.status === 200;
    results.push({
      name: 'GET /api/categorization/jobs',
      passed,
      statusCode: response.status,
      error: passed ? undefined : `Expected 200, got ${response.status}: ${JSON.stringify(responseData)}`,
      data: passed ? responseData : undefined,
    });

    if (passed) {
      console.log(`   ✅ Success! Status: ${response.status}`);
      console.log(`   📊 Jobs returned: ${responseData.jobs?.length || 0}`);
      if (responseData.pagination) {
        console.log(`   📄 Total: ${responseData.pagination.total}`);
      }
    } else {
      console.log(`   ❌ Failed! Status: ${response.status}`);
      console.log(`   Error: ${JSON.stringify(responseData)}`);
    }
  } catch (error) {
    results.push({
      name: 'GET /api/categorization/jobs',
      passed: false,
      error: error.message,
    });
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 5: Test with proper Supabase cookie format
  console.log('\n📝 Test 5: GET /api/categorization/jobs (with Supabase cookies)...');
  try {
    // Extract the project ref from the Supabase URL
    const projectRef = SUPABASE_URL.split('//')[1]?.split('.')[0] || 'localhost';
    
    // Create proper Supabase cookie format
    const cookies = [
      `sb-${projectRef}-auth-token=${session.access_token}`,
      `sb-${projectRef}-auth-token.0=${session.refresh_token}`,
    ].join('; ');

    const response = await fetch(`${API_BASE_URL}/api/categorization/jobs`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
      },
      credentials: 'include',
    });

    const responseData = await response.json().catch(() => ({}));
    
    const passed = response.status === 200;
    results.push({
      name: 'GET /api/categorization/jobs (Supabase cookies)',
      passed,
      statusCode: response.status,
      error: passed ? undefined : `Expected 200, got ${response.status}: ${JSON.stringify(responseData)}`,
      data: passed ? responseData : undefined,
    });

    if (passed) {
      console.log(`   ✅ Success! Status: ${response.status}`);
      console.log(`   📊 Jobs returned: ${responseData.jobs?.length || 0}`);
    } else {
      console.log(`   ❌ Failed! Status: ${response.status}`);
      console.log(`   Error: ${JSON.stringify(responseData)}`);
    }
  } catch (error) {
    results.push({
      name: 'GET /api/categorization/jobs (Supabase cookies)',
      passed: false,
      error: error.message,
    });
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 6: Test transactions endpoint if we have jobs
  if (results.some(r => r.name.includes('jobs') && r.passed && r.data?.jobs?.length > 0)) {
    const jobsResult = results.find(r => r.name.includes('jobs') && r.passed && r.data?.jobs);
    const jobId = jobsResult?.data?.jobs[0]?.id;

    if (jobId) {
      console.log(`\n📝 Test 6: GET /api/categorization/jobs/${jobId}/transactions...`);
      try {
        const projectRef = SUPABASE_URL.split('//')[1]?.split('.')[0] || 'localhost';
        const cookies = [
          `sb-${projectRef}-auth-token=${session.access_token}`,
          `sb-${projectRef}-auth-token.0=${session.refresh_token}`,
        ].join('; ');

        const response = await fetch(`${API_BASE_URL}/api/categorization/jobs/${jobId}/transactions`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookies,
          },
          credentials: 'include',
        });

        const responseData = await response.json().catch(() => ({}));
        
        const passed = response.status === 200;
        results.push({
          name: `GET /api/categorization/jobs/${jobId}/transactions`,
          passed,
          statusCode: response.status,
          error: passed ? undefined : `Expected 200, got ${response.status}`,
          data: passed ? responseData : undefined,
        });

        if (passed) {
          console.log(`   ✅ Success! Status: ${response.status}`);
          console.log(`   📊 Transactions returned: ${responseData.transactions?.length || 0}`);
        } else {
          console.log(`   ❌ Failed! Status: ${response.status}`);
        }
      } catch (error) {
        results.push({
          name: `GET /api/categorization/jobs/${jobId}/transactions`,
          passed: false,
          error: error.message,
        });
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
  }

  // Print summary
  printResults(results);

  // Exit with appropriate code
  const allPassed = results.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

function printResults(results) {
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

