#!/usr/bin/env tsx
/**
 * Cleanup Script for Incorrect Invoice Transactions
 * 
 * This script identifies and removes transactions that were incorrectly
 * created from invoice uploads.
 * 
 * Usage:
 *   npx tsx scripts/cleanup-transactions.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

// Create admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper to ask for confirmation
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function identifyProblematicTransactions() {
  console.log('\n🔍 Identifying problematic transactions...\n');

  // Find transactions linked to financial_documents
  const { data: transactionsWithDocs, error: error1 } = await supabase
    .from('categorized_transactions')
    .select('id, original_description, amount, date, created_at, document_id')
    .not('document_id', 'is', null)
    .order('created_at', { ascending: false });

  if (error1) {
    console.error('❌ Error querying transactions with documents:', error1);
    return null;
  }

  // Find transactions with suspicious descriptions
  const { data: suspiciousTransactions, error: error2 } = await supabase
    .from('categorized_transactions')
    .select('id, original_description, amount, date, created_at, document_id')
    .or(
      'original_description.ilike.%subtotal%,' +
      'original_description.ilike.%tax%,' +
      'original_description.ilike.%vat%,' +
      'original_description.ilike.%2025%,' +
      'original_description.ilike.%2024%,' +
      'original_description.ilike.% to %'
    )
    .order('created_at', { ascending: false });

  if (error2) {
    console.error('❌ Error querying suspicious transactions:', error2);
  }

  // Combine and deduplicate
  const allTransactions = [
    ...(transactionsWithDocs || []),
    ...(suspiciousTransactions || []),
  ];
  
  const uniqueTransactions = Array.from(
    new Map(allTransactions.map(t => [t.id, t])).values()
  );

  return uniqueTransactions;
}

function categorizeTransaction(t: any): string {
  if (t.document_id) return 'Linked to invoice';
  if (t.original_description?.toLowerCase().includes('subtotal')) return 'Subtotal';
  if (t.original_description?.toLowerCase().includes('tax') || 
      t.original_description?.toLowerCase().includes('vat')) return 'Tax/VAT';
  if (t.original_description?.match(/20\d{2}/)) return 'Date as amount';
  return 'Other suspicious';
}

async function showPreview(transactions: any[]) {
  console.log('📊 Preview of transactions to be deleted:\n');
  console.log(`Total transactions: ${transactions.length}`);
  console.log(`Total amount: £${transactions.reduce((sum, t) => sum + (t.amount || 0), 0).toFixed(2)}\n`);

  // Group by category
  const byCategory: Record<string, { count: number; total: number; examples: any[] }> = {};
  
  transactions.forEach(t => {
    const category = categorizeTransaction(t);
    
    if (!byCategory[category]) {
      byCategory[category] = { count: 0, total: 0, examples: [] };
    }
    byCategory[category].count++;
    byCategory[category].total += t.amount || 0;
    
    if (byCategory[category].examples.length < 3) {
      byCategory[category].examples.push(t);
    }
  });

  console.log('Breakdown by category:');
  console.log('─────────────────────────────────────────────────────────────');
  
  Object.entries(byCategory).forEach(([category, data]) => {
    console.log(`\n${category}:`);
    console.log(`  Count: ${data.count}`);
    console.log(`  Total: £${data.total.toFixed(2)}`);
    console.log(`  Examples:`);
    data.examples.forEach(ex => {
      const desc = ex.original_description?.substring(0, 50) || 'N/A';
      console.log(`    - ${desc} | £${ex.amount.toFixed(2)} | ${ex.date}`);
    });
  });

  console.log('\n─────────────────────────────────────────────────────────────\n');
}

async function executeCleanup(transactionIds: string[]) {
  console.log('\n🗑️  Executing cleanup...\n');

  // Delete transactions
  const { error } = await supabase
    .from('categorized_transactions')
    .delete()
    .in('id', transactionIds);

  if (error) {
    console.error('❌ Error deleting transactions:', error);
    return false;
  }

  return true;
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Invoice Transaction Cleanup Script                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('This script will remove transactions that were incorrectly');
  console.log('created from invoice uploads. These should be documents for');
  console.log('reconciliation, not entries in your statements.\n');

  // Step 1: Identify problematic transactions
  const transactions = await identifyProblematicTransactions();
  
  if (!transactions || transactions.length === 0) {
    console.log('✅ No problematic transactions found!');
    console.log('Your database is clean. All invoice uploads are working correctly.\n');
    process.exit(0);
  }

  // Step 2: Show preview
  await showPreview(transactions);

  // Step 3: Ask for confirmation
  console.log('⚠️  WARNING: This will permanently delete these transactions!');
  console.log('Financial documents (invoices) will remain intact.\n');
  
  const answer = await askQuestion('Do you want to proceed with cleanup? (yes/no): ');
  
  if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
    console.log('\n❌ Cleanup cancelled. No transactions were deleted.\n');
    process.exit(0);
  }

  // Step 4: Execute cleanup
  const transactionIds = transactions.map(t => t.id);
  const success = await executeCleanup(transactionIds);

  if (success) {
    console.log('✅ Cleanup complete!\n');
    console.log(`Deleted ${transactions.length} transactions`);
    console.log(`Total amount removed: £${transactions.reduce((sum, t) => sum + (t.amount || 0), 0).toFixed(2)}\n`);
    console.log('Next steps:');
    console.log('1. Refresh your Statements page - incorrect entries should be gone');
    console.log('2. Go to Reconciliation page - use Auto-Match or manual dropdown');
    console.log('3. Upload new invoices - they will NOT create transactions\n');
  } else {
    console.log('❌ Cleanup failed. Check the error messages above.\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
