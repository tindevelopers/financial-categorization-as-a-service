#!/usr/bin/env tsx
/**
 * Test script to check transactions endpoint response
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const JOB_ID = 'cae5175a-e5a7-49fd-8850-4a25c7021413';

async function testTransactionsEndpoint() {
  console.log('🧪 Testing Transactions Endpoint\n');
  console.log(`📋 Job ID: ${JOB_ID}\n`);

  // Use service role key to bypass RLS for testing
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // 1. Check if job exists
    console.log('1️⃣ Checking if job exists...');
    const { data: job, error: jobError } = await supabase
      .from('categorization_jobs')
      .select('id, user_id, status, original_filename, created_at, total_items, processed_items, failed_items')
      .eq('id', JOB_ID)
      .single();

    if (jobError || !job) {
      console.error('   ❌ Job not found:', jobError?.message);
      return;
    }

    console.log('   ✅ Job found:');
    console.log(`      - User ID: ${job.user_id}`);
    console.log(`      - Status: ${job.status}`);
    console.log(`      - File: ${job.original_filename || 'N/A'}`);
    console.log(`      - Created: ${job.created_at}`);
    console.log(`      - Total Items: ${job.total_items || 'N/A'}`);
    console.log(`      - Processed: ${job.processed_items || 0}`);
    console.log(`      - Failed: ${job.failed_items || 0}\n`);

    // 2. Check transactions count
    console.log('2️⃣ Checking transactions...');
    const { data: transactions, error: transactionsError, count } = await supabase
      .from('categorized_transactions')
      .select('*', { count: 'exact' })
      .eq('job_id', JOB_ID);

    if (transactionsError) {
      console.error('   ❌ Error fetching transactions:', transactionsError.message);
      return;
    }

    console.log(`   📊 Found ${count || transactions?.length || 0} transactions\n`);

    if (!transactions || transactions.length === 0) {
      console.log('   ⚠️  No transactions found for this job!\n');
      console.log('   💡 This explains why the review page is stuck loading.');
      console.log('   💡 The endpoint returns an empty array, but the UI expects data.\n');
      
      // Check if there are any transactions for this user
      const { data: userTransactions, count: userCount } = await supabase
        .from('categorized_transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', job.user_id)
        .limit(5);

      console.log(`   📋 User has ${userCount || 0} total transactions across all jobs\n`);
      
      if (userTransactions && userTransactions.length > 0) {
        console.log('   📝 Sample transaction structure:');
        console.log(JSON.stringify(userTransactions[0], null, 2));
      }
    } else {
      console.log('   ✅ Transactions found! Sample:');
      console.log(JSON.stringify(transactions[0], null, 2));
      console.log(`\n   📋 Total: ${transactions.length} transactions`);
    }

    // 3. Simulate what the endpoint returns
    console.log('\n3️⃣ Endpoint Response Structure:');
    const endpointResponse = {
      success: true,
      transactions: transactions || [],
    };
    console.log(JSON.stringify(endpointResponse, null, 2));

    // 4. Check job status
    console.log('\n4️⃣ Job Processing Status:');
    const { data: jobDetails } = await supabase
      .from('categorization_jobs')
      .select('status, total_items, processed_items, failed_items, error_message')
      .eq('id', JOB_ID)
      .single();

    if (jobDetails) {
      console.log(`   Status: ${jobDetails.status}`);
      console.log(`   Total Items: ${jobDetails.total_items || 'N/A'}`);
      console.log(`   Processed: ${jobDetails.processed_items || 'N/A'}`);
      console.log(`   Failed: ${jobDetails.failed_items || 'N/A'}`);
      if (jobDetails.error_message) {
        console.log(`   Error: ${jobDetails.error_message}`);
      }
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

testTransactionsEndpoint()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

