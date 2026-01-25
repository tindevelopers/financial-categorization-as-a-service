#!/usr/bin/env tsx
/**
 * Migration script to link existing transactions to their bank accounts
 * This updates the bank_account_id for all transactions based on their job's bank_account_id
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from apps/portal/.env.local
const envPath = path.join(__dirname, '../apps/portal/.env.local');
console.log(`Loading environment from: ${envPath}`);
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateLinkTransactionsToBankAccounts() {
  console.log('Starting migration to link transactions to bank accounts...\n');

  try {
    // Step 1: Get all jobs with their bank_account_id
    console.log('Step 1: Fetching all jobs with bank accounts...');
    const { data: jobs, error: jobsError } = await supabase
      .from('categorization_jobs')
      .select('id, bank_account_id, original_filename')
      .not('bank_account_id', 'is', null);

    if (jobsError) {
      throw new Error(`Failed to fetch jobs: ${jobsError.message}`);
    }

    console.log(`Found ${jobs?.length || 0} jobs with bank accounts\n`);

    if (!jobs || jobs.length === 0) {
      console.log('No jobs with bank accounts found. Nothing to migrate.');
      return;
    }

    // Step 2: For each job, update its transactions
    let totalUpdated = 0;
    let totalErrors = 0;

    for (const job of jobs) {
      console.log(`Processing job: ${job.id} (${job.original_filename})`);
      console.log(`  Bank Account ID: ${job.bank_account_id}`);

      // Count transactions for this job that need updating
      const { count: needsUpdateCount, error: countError } = await supabase
        .from('categorized_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', job.id)
        .is('bank_account_id', null);

      if (countError) {
        console.error(`  ❌ Error counting transactions: ${countError.message}`);
        totalErrors++;
        continue;
      }

      if (needsUpdateCount === 0) {
        console.log(`  ✓ All transactions already linked\n`);
        continue;
      }

      console.log(`  Found ${needsUpdateCount} transactions to update`);

      // Update transactions for this job
      const { data: updated, error: updateError } = await supabase
        .from('categorized_transactions')
        .update({ bank_account_id: job.bank_account_id })
        .eq('job_id', job.id)
        .is('bank_account_id', null)
        .select('id');

      if (updateError) {
        console.error(`  ❌ Error updating transactions: ${updateError.message}`);
        totalErrors++;
        continue;
      }

      const updatedCount = updated?.length || 0;
      totalUpdated += updatedCount;
      console.log(`  ✓ Updated ${updatedCount} transactions\n`);
    }

    // Step 3: Summary
    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary:');
    console.log('='.repeat(60));
    console.log(`Total jobs processed: ${jobs.length}`);
    console.log(`Total transactions updated: ${totalUpdated}`);
    console.log(`Errors encountered: ${totalErrors}`);
    console.log('='.repeat(60));

    // Step 4: Verify results
    console.log('\nVerifying results...');
    const { count: remainingCount, error: verifyError } = await supabase
      .from('categorized_transactions')
      .select('id', { count: 'exact', head: true })
      .is('bank_account_id', null);

    if (verifyError) {
      console.error(`Error verifying: ${verifyError.message}`);
    } else {
      console.log(`Transactions still without bank_account_id: ${remainingCount || 0}`);
      
      if (remainingCount === 0) {
        console.log('\n✅ Migration completed successfully! All transactions are now linked.');
      } else {
        console.log('\n⚠️  Some transactions still need linking (they may be from jobs without bank accounts)');
      }
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
migrateLinkTransactionsToBankAccounts()
  .then(() => {
    console.log('\nMigration script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFatal error:', error);
    process.exit(1);
  });
