#!/usr/bin/env tsx
/**
 * Check transaction amounts to debug display issue
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const envPath = path.join(__dirname, '../apps/portal/.env.local');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAmounts() {
  console.log('Checking transaction amounts...\n');

  const bankAccountId = '04db1888-8da3-4a87-bf15-987c724e24a9'; // HSBC account

  const { data: transactions, error } = await supabase
    .from('categorized_transactions')
    .select('id, date, original_description, amount, transaction_type, is_debit')
    .eq('bank_account_id', bankAccountId)
    .order('date', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Summary:');
  const credits = transactions?.filter(t => !t.is_debit).length || 0;
  const debits = transactions?.filter(t => t.is_debit).length || 0;
  console.log(`Credits (incoming): ${credits}`);
  console.log(`Debits (outgoing): ${debits}`);
  
  console.log('\n='.repeat(120));
  console.log('Sample DEBIT transactions (showing first 10):');
  console.log('='.repeat(120));
  
  const debitTransactions = transactions?.filter(t => t.is_debit) || [];
  debitTransactions.slice(0, 10).forEach((t, i) => {
    const desc = (t.original_description || '').substring(0, 30).padEnd(30);
    const display = `-£${t.amount}`;
    console.log(`${String(i + 1).padStart(2)}. ${t.date} | ${desc} | DEBIT  | ${display.padStart(12)}`);
  });
  
  if (debitTransactions.length === 0) {
    console.log('No debit transactions found in the sample.');
  }
  
  console.log('\n='.repeat(120));
  console.log('Sample CREDIT transactions (showing first 10):');
  console.log('='.repeat(120));
  
  const creditTransactions = transactions?.filter(t => !t.is_debit) || [];
  creditTransactions.slice(0, 10).forEach((t, i) => {
    const desc = (t.original_description || '').substring(0, 30).padEnd(30);
    const display = `+£${t.amount}`;
    console.log(`${String(i + 1).padStart(2)}. ${t.date} | ${desc} | CREDIT | ${display.padStart(12)}`);
  });
}

checkAmounts();
