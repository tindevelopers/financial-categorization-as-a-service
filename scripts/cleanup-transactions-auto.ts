#!/usr/bin/env tsx
/**
 * Auto-Cleanup Script for Incorrect Invoice Transactions
 * Automatically proceeds with cleanup without asking for confirmation
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('🚀 Starting automatic cleanup...\n');

  // Find transactions linked to financial_documents
  const { data: transactionsWithDocs } = await supabase
    .from('categorized_transactions')
    .select('id, original_description, amount, date')
    .not('document_id', 'is', null);

  // Find transactions with suspicious descriptions
  const { data: suspiciousTransactions } = await supabase
    .from('categorized_transactions')
    .select('id, original_description, amount, date')
    .or(
      'original_description.ilike.%subtotal%,' +
      'original_description.ilike.%tax%,' +
      'original_description.ilike.%vat%,' +
      'original_description.ilike.%2025%,' +
      'original_description.ilike.%2024%,' +
      'original_description.ilike.% to %'
    );

  // Combine and deduplicate
  const allTransactions = [
    ...(transactionsWithDocs || []),
    ...(suspiciousTransactions || []),
  ];
  
  const uniqueTransactions = Array.from(
    new Map(allTransactions.map(t => [t.id, t])).values()
  );

  if (uniqueTransactions.length === 0) {
    console.log('✅ No problematic transactions found!\n');
    return;
  }

  console.log(`Found ${uniqueTransactions.length} transactions to delete`);
  console.log(`Total amount: £${uniqueTransactions.reduce((sum, t) => sum + (t.amount || 0), 0).toFixed(2)}\n`);

  // Show examples
  console.log('Examples:');
  uniqueTransactions.slice(0, 5).forEach(t => {
    console.log(`  - ${t.original_description?.substring(0, 50)} | £${t.amount?.toFixed(2)} | ${t.date}`);
  });
  console.log('');

  // Delete
  const transactionIds = uniqueTransactions.map(t => t.id);
  console.log('🗑️  Deleting transactions...');
  
  const { error } = await supabase
    .from('categorized_transactions')
    .delete()
    .in('id', transactionIds);

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log('\n✅ Cleanup complete!');
  console.log(`Deleted ${uniqueTransactions.length} transactions\n`);
  console.log('Next steps:');
  console.log('1. Refresh your Statements page');
  console.log('2. Go to Reconciliation page to match invoices');
  console.log('3. Upload new invoices - they will NOT create transactions\n');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
