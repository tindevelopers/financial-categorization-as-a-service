/**
 * Test script to directly process a bank statement CSV
 * Run with: npx tsx scripts/test-bank-processing.ts
 * 
 * Make sure to set environment variables in apps/portal/.env.local:
 * - USE_AI_CATEGORIZATION=true
 * - AI_GATEWAY_API_KEY=your-key-from-vercel-dashboard
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import * as dotenv from 'dotenv';

// Load environment variables from apps/portal/.env.local
const envPath = path.join(__dirname, '..', 'apps', 'portal', '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('Loaded environment from:', envPath);
}

// Check if required environment variables are set
console.log('\n=== Environment Check ===');
console.log('USE_AI_CATEGORIZATION:', process.env.USE_AI_CATEGORIZATION || '(not set)');
console.log('AI_CATEGORIZATION_PROVIDER:', process.env.AI_CATEGORIZATION_PROVIDER || '(not set)');
console.log('AI_GATEWAY_API_KEY:', process.env.AI_GATEWAY_API_KEY ? `(set - ${process.env.AI_GATEWAY_API_KEY.substring(0, 10)}...)` : '⚠️  NOT SET');

if (process.env.USE_AI_CATEGORIZATION === 'true' && !process.env.AI_GATEWAY_API_KEY) {
  console.log('\n⚠️  WARNING: USE_AI_CATEGORIZATION=true but AI_GATEWAY_API_KEY is not set!');
  console.log('   AI categorization will fail.');
  console.log('   Get your API key from: https://vercel.com/dashboard -> AI Gateway -> API Keys');
}

interface Transaction {
  date: Date | string;
  description: string;
  amount: number;
}

interface CategorizedTransaction extends Transaction {
  category?: string;
  subcategory?: string;
  confidenceScore?: number;
}

function parseDate(value: any): string | null {
  if (!value) return null;
  
  // If it's a string like "31 Jul 2025"
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }
  
  return null;
}

function parseAmount(value: any): number | null {
  if (value === undefined || value === null || value === '') return null;
  
  if (typeof value === 'number') return value;
  
  if (typeof value === 'string') {
    const cleaned = value.replace(/[£$,]/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  
  return null;
}

function extractTransactions(data: any[]): Transaction[] {
  const transactions: Transaction[] = [];

  for (const row of data) {
    // For HSBC format:
    // Date, Payment Description/Reference, Payee/Payer Name, Transaction Type, Category, Sub category, Paid In Amount, Paid Out Amount
    const date = parseDate(row['Date']);
    const description = row['Payment Description/Reference'] || row['Payee/Payer Name'] || '';
    const payee = row['Payee/Payer Name'] || '';
    
    // Combine description with payee for better context
    const fullDescription = `${description.trim()} - ${payee.trim()}`.trim().replace(/^- /, '').replace(/ -$/, '');
    
    // Get amount - positive for paid in, negative for paid out
    let amount: number | null = null;
    const paidIn = parseAmount(row['Paid In Amount (GBP)']);
    const paidOut = parseAmount(row['Paid Out Amount (GBP)']);
    
    if (paidIn !== null && paidIn > 0) {
      amount = paidIn;
    } else if (paidOut !== null && paidOut > 0) {
      amount = -paidOut; // Make paid out negative
    }

    if (date && fullDescription && amount !== null) {
      transactions.push({
        date,
        description: fullDescription,
        amount,
      });
    }
  }

  return transactions;
}

async function categorizeWithAI(transactions: Transaction[]): Promise<CategorizedTransaction[]> {
  console.log('\n=== AI Categorization ===');
  
  const useAI = process.env.USE_AI_CATEGORIZATION === 'true';
  console.log('AI Categorization enabled:', useAI);
  
  if (!useAI) {
    console.log('Skipping AI categorization (USE_AI_CATEGORIZATION !== "true")');
    return transactions.map(tx => ({
      ...tx,
      category: 'Uncategorized',
      confidenceScore: 0.5,
    }));
  }

  try {
    // Dynamically import the AI service
    const { AICategorizationFactory } = await import('../apps/portal/lib/ai/AICategorizationFactory');
    const provider = AICategorizationFactory.getDefaultProvider();
    console.log('AI Provider:', provider);
    
    const aiService = AICategorizationFactory.create(provider, []);
    console.log('AI Service created successfully');
    
    // Convert to AI format
    const aiTransactions = transactions.map(tx => ({
      original_description: tx.description,
      amount: tx.amount,
      date: typeof tx.date === 'string' ? tx.date : tx.date.toISOString().split('T')[0],
    }));
    
    console.log(`Processing ${aiTransactions.length} transactions in batches...`);
    
    // Process in batches of 20
    const BATCH_SIZE = 20;
    const results: CategorizedTransaction[] = [];
    
    for (let i = 0; i < aiTransactions.length; i += BATCH_SIZE) {
      const batch = aiTransactions.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(aiTransactions.length / BATCH_SIZE);
      
      console.log(`  Batch ${batchNum}/${totalBatches}: Processing ${batch.length} transactions...`);
      
      try {
        const batchResults = await aiService.categorizeBatch(batch);
        console.log(`  Batch ${batchNum}/${totalBatches}: Got ${batchResults.length} results`);
        
        // Merge results
        for (let j = 0; j < batch.length; j++) {
          const originalTx = transactions[i + j];
          const aiResult = batchResults[j];
          results.push({
            ...originalTx,
            category: aiResult.category,
            subcategory: aiResult.subcategory,
            confidenceScore: aiResult.confidenceScore,
          });
        }
      } catch (batchError: any) {
        console.error(`  Batch ${batchNum} failed:`, batchError.message);
        // Add uncategorized fallback for this batch
        for (let j = 0; j < batch.length; j++) {
          results.push({
            ...transactions[i + j],
            category: 'Uncategorized',
            confidenceScore: 0.3,
          });
        }
      }
    }
    
    return results;
  } catch (error: any) {
    console.error('AI Categorization failed:', error.message);
    console.error('Stack:', error.stack);
    return transactions.map(tx => ({
      ...tx,
      category: 'Uncategorized',
      confidenceScore: 0.3,
    }));
  }
}

async function main() {
  console.log('=== Bank Statement Processing Test ===\n');
  
  // Path to the test file
  const filePath = "/Users/gene/Library/CloudStorage/Dropbox/! @ V SUBS SHARED/GWH/Accoounting/HSBC Transactions/Transaction List 01 Jul 2025 to 31 Jul 2025.csv";
  
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }
  
  console.log('Reading file:', filePath);
  
  // Read and parse CSV
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });
  
  console.log('Rows in file:', data.length);
  console.log('First row keys:', Object.keys(data[0] || {}));
  console.log('Sample row:', JSON.stringify(data[0], null, 2));
  
  // Extract transactions
  console.log('\n=== Extracting Transactions ===');
  const transactions = extractTransactions(data);
  console.log('Extracted transactions:', transactions.length);
  
  if (transactions.length > 0) {
    console.log('\nSample transactions:');
    transactions.slice(0, 3).forEach((tx, i) => {
      console.log(`  ${i + 1}. ${tx.date} | ${tx.description.substring(0, 40)}... | £${tx.amount}`);
    });
  }
  
  // Categorize with AI
  const categorized = await categorizeWithAI(transactions);
  
  // Display results
  console.log('\n=== Categorization Results ===');
  console.log('Total categorized:', categorized.length);
  
  // Group by category
  const byCategory: Record<string, number> = {};
  for (const tx of categorized) {
    const cat = tx.category || 'Uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }
  
  console.log('\nCategory distribution:');
  for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }
  
  console.log('\nSample categorized transactions:');
  categorized.slice(0, 10).forEach((tx, i) => {
    console.log(`  ${i + 1}. [${tx.category}] ${tx.description.substring(0, 35)}... | £${tx.amount} (${(tx.confidenceScore || 0) * 100}%)`);
  });
  
  console.log('\n=== Test Complete ===');
}

main().catch(console.error);

