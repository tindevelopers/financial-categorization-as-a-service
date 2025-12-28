#!/usr/bin/env tsx
/**
 * Invoice OCR Test Script
 * 
 * Tests the Google Document AI OCR extraction on sample invoices.
 * 
 * Usage:
 *   pnpm tsx scripts/test-invoice-ocr.ts [invoice-paths...]
 * 
 * If no paths provided, uses the sample invoices defined below.
 * 
 * Required Environment Variables:
 *   - GOOGLE_CLOUD_PROJECT_ID
 *   - GOOGLE_DOCUMENT_AI_PROCESSOR_ID
 *   - GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON)
 *   - OR GOOGLE_APPLICATION_CREDENTIALS_JSON (base64 encoded)
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment from apps/portal/.env.local if it exists
const envPath = path.resolve(__dirname, '../apps/portal/.env.local');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
  console.log('✓ Loaded environment from apps/portal/.env.local');
} else {
  config();
  console.log('✓ Loaded environment from .env');
}

// Sample invoices data for testing (from user-provided samples)
const SAMPLE_INVOICES = [
  {
    name: 'Lodgify Invoice (€63.98)',
    expected: {
      vendor: 'Lodgify',
      amount: 63.98,
      currency: 'EUR',
      invoice_number: 'LD-2024-1000105683',
      date: '2024-08-27',
      category: 'Software & Subscriptions'
    }
  },
  {
    name: 'Lodgify Invoice (€280.29)',
    expected: {
      vendor: 'Lodgify',
      amount: 280.29,
      currency: 'EUR',
      invoice_number: 'LD-2024-1000122647',
      date: '2024-10-01',
      category: 'Software & Subscriptions'
    }
  },
  {
    name: 'M&M Windows Invoice (£1,332.00)',
    expected: {
      vendor: 'M&M Windows (SW) Ltd',
      amount: 1332.00,
      currency: 'GBP',
      invoice_number: 'SI-750',
      date: '2024-12-18',
      category: 'Construction Services'
    }
  },
  {
    name: 'British Gas Electricity Bill (£1,429.22)',
    expected: {
      vendor: 'British Gas',
      amount: 1429.22, // Total due (or 310.61 for new charges)
      currency: 'GBP',
      invoice_number: '827262908',
      date: '2023-10-20',
      category: 'Utilities'
    }
  }
];

// Color helpers for terminal output
const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

interface InvoiceData {
  vendor_name?: string;
  invoice_date?: string;
  invoice_number?: string;
  order_number?: string;
  delivery_date?: string;
  line_items?: Array<{
    description: string;
    quantity?: number;
    unit_price?: number;
    total: number;
  }>;
  subtotal?: number;
  tax?: number;
  total?: number;
  currency?: string;
  extracted_text?: string;
  confidence_score?: number;
  field_confidence?: Record<string, number>;
  extraction_methods?: Record<string, string>;
  validation_flags?: Record<string, boolean>;
  needs_review?: boolean;
  ocr_configured?: boolean;
  ocr_failed?: boolean;
  ocr_error?: string;
}

async function testOCRConfiguration(): Promise<boolean> {
  console.log('\n' + colors.bold('=== OCR Configuration Check ===\n'));
  
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();
  const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID?.trim();
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  
  const checks = [
    { name: 'GOOGLE_CLOUD_PROJECT_ID', value: projectId, status: !!projectId },
    { name: 'GOOGLE_DOCUMENT_AI_PROCESSOR_ID', value: processorId, status: !!processorId },
    { name: 'Credentials (PATH or JSON)', value: credentials ? '(set)' : undefined, status: !!credentials },
  ];
  
  let allPassed = true;
  for (const check of checks) {
    const icon = check.status ? colors.green('✓') : colors.red('✗');
    const value = check.value ? colors.gray(`(${check.value.substring(0, 30)}...)`) : colors.red('(missing)');
    console.log(`  ${icon} ${check.name} ${value}`);
    if (!check.status) allPassed = false;
  }
  
  if (!allPassed) {
    console.log(colors.red('\n⚠️  OCR is not fully configured. Please set the missing environment variables.'));
    return false;
  }
  
  console.log(colors.green('\n✓ OCR configuration looks good!'));
  return true;
}

async function processInvoiceFile(filePath: string): Promise<InvoiceData | null> {
  // Dynamic import to use the actual OCR module
  const ocrModule = await import('../apps/portal/lib/ocr/google-document-ai');
  
  if (!fs.existsSync(filePath)) {
    console.log(colors.red(`  ✗ File not found: ${filePath}`));
    return null;
  }
  
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { 
    type: filePath.endsWith('.pdf') ? 'application/pdf' : 'image/png' 
  });
  
  const filename = path.basename(filePath);
  
  try {
    const result = await ocrModule.processInvoiceOCR(blob, filename);
    return result;
  } catch (error: any) {
    console.log(colors.red(`  ✗ OCR Error: ${error.message}`));
    return null;
  }
}

function formatCurrency(amount: number | undefined, currency: string | undefined): string {
  if (amount === undefined) return '(not extracted)';
  const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  return `${symbol}${amount.toFixed(2)} ${currency || 'USD'}`;
}

function printExtractionResult(result: InvoiceData, expected?: typeof SAMPLE_INVOICES[0]['expected']): void {
  console.log('\n  ' + colors.bold('Extracted Data:'));
  
  // Helper to compare and show match status
  const showField = (label: string, value: any, expectedValue?: any) => {
    const displayValue = value !== undefined && value !== null ? String(value) : colors.yellow('(not extracted)');
    let matchIcon = '';
    
    if (expectedValue !== undefined && value !== undefined) {
      // Fuzzy matching for strings
      if (typeof expectedValue === 'string' && typeof value === 'string') {
        const matches = value.toLowerCase().includes(expectedValue.toLowerCase()) ||
                       expectedValue.toLowerCase().includes(value.toLowerCase());
        matchIcon = matches ? colors.green(' ✓') : colors.red(' ✗');
      } else if (typeof expectedValue === 'number') {
        // For numbers, allow small tolerance
        const matches = Math.abs((value as number) - expectedValue) < 0.01;
        matchIcon = matches ? colors.green(' ✓') : colors.red(' ✗');
      }
    }
    
    const confidence = result.field_confidence?.[label.toLowerCase().replace(/\s/g, '_')];
    const method = result.extraction_methods?.[label.toLowerCase().replace(/\s/g, '_')];
    const meta = [];
    if (confidence !== undefined) meta.push(`conf: ${(confidence * 100).toFixed(0)}%`);
    if (method) meta.push(`via: ${method}`);
    
    console.log(`    ${label}: ${displayValue}${matchIcon} ${meta.length ? colors.gray(`(${meta.join(', ')})`) : ''}`);
  };
  
  showField('Vendor', result.vendor_name, expected?.vendor);
  showField('Total', result.total !== undefined ? formatCurrency(result.total, result.currency) : undefined, expected?.amount);
  showField('Currency', result.currency, expected?.currency);
  showField('Invoice #', result.invoice_number, expected?.invoice_number);
  showField('Date', result.invoice_date, expected?.date);
  showField('Subtotal', result.subtotal !== undefined ? formatCurrency(result.subtotal, result.currency) : undefined);
  showField('Tax', result.tax !== undefined ? formatCurrency(result.tax, result.currency) : undefined);
  
  // Line items
  if (result.line_items && result.line_items.length > 0) {
    console.log(`    ${colors.bold('Line Items')} (${result.line_items.length}):`);
    for (const item of result.line_items.slice(0, 5)) {
      const desc = item.description.length > 40 ? item.description.substring(0, 40) + '...' : item.description;
      console.log(`      - ${desc}: ${formatCurrency(item.total, result.currency)}`);
    }
    if (result.line_items.length > 5) {
      console.log(colors.gray(`      ... and ${result.line_items.length - 5} more items`));
    }
  }
  
  // Overall metrics
  console.log('\n  ' + colors.bold('Quality Metrics:'));
  console.log(`    Overall Confidence: ${result.confidence_score !== undefined ? `${(result.confidence_score * 100).toFixed(0)}%` : 'N/A'}`);
  console.log(`    Needs Review: ${result.needs_review ? colors.yellow('Yes') : colors.green('No')}`);
  console.log(`    OCR Status: ${result.ocr_failed ? colors.red('Failed') : colors.green('Success')}`);
  
  // Show a snippet of extracted text
  if (result.extracted_text && result.extracted_text.length > 0) {
    const textPreview = result.extracted_text.substring(0, 200).replace(/\n/g, ' ').trim();
    console.log(`\n  ${colors.bold('Text Preview')}: ${colors.gray(textPreview)}...`);
  }
}

async function runTests(invoicePaths: string[]): Promise<void> {
  console.log('\n' + colors.bold('=== Invoice OCR Test Results ==='));
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < invoicePaths.length; i++) {
    const filePath = invoicePaths[i];
    const sampleInfo = SAMPLE_INVOICES[i];
    
    console.log(`\n${colors.blue(`[${i + 1}/${invoicePaths.length}]`)} ${colors.bold(sampleInfo?.name || path.basename(filePath))}`);
    console.log(colors.gray(`  File: ${filePath}`));
    
    if (sampleInfo?.expected) {
      console.log(colors.gray(`  Expected: ${sampleInfo.expected.vendor} - ${formatCurrency(sampleInfo.expected.amount, sampleInfo.expected.currency)}`));
    }
    
    const result = await processInvoiceFile(filePath);
    
    if (result && !result.ocr_failed) {
      printExtractionResult(result, sampleInfo?.expected);
      
      // Check if key fields were extracted
      const hasVendor = !!result.vendor_name;
      const hasAmount = result.total !== undefined;
      const hasInvoiceNum = !!result.invoice_number;
      
      if (hasVendor && hasAmount) {
        console.log(colors.green('\n  ✓ PASS - Key fields extracted'));
        successCount++;
      } else {
        const missing = [];
        if (!hasVendor) missing.push('vendor');
        if (!hasAmount) missing.push('amount');
        if (!hasInvoiceNum) missing.push('invoice number');
        console.log(colors.yellow(`\n  ⚠ PARTIAL - Missing: ${missing.join(', ')}`));
        failCount++;
      }
    } else {
      console.log(colors.red(`\n  ✗ FAIL - OCR extraction failed`));
      if (result?.ocr_error) {
        console.log(colors.red(`    Error: ${result.ocr_error}`));
      }
      failCount++;
    }
  }
  
  // Summary
  console.log('\n' + colors.bold('=== Summary ==='));
  console.log(`  Total: ${invoicePaths.length}`);
  console.log(`  ${colors.green('Passed')}: ${successCount}`);
  console.log(`  ${colors.red('Failed/Partial')}: ${failCount}`);
  
  if (failCount > 0) {
    console.log(colors.yellow('\n⚠️  Some invoices did not extract properly. Review the OCR parsing logic.'));
  } else {
    console.log(colors.green('\n✓ All invoices extracted successfully!'));
  }
}

async function simulateWithSampleText(): Promise<void> {
  console.log('\n' + colors.bold('=== Simulating with Sample Invoice Text ==='));
  console.log(colors.gray('  (Using pre-loaded invoice content for testing extraction patterns)\n'));
  
  // Simulate extraction patterns with known invoice text
  const sampleTexts = [
    {
      name: 'Lodgify Invoice',
      text: `LODGIFY
Codebay Solutions LTD
TAX INVOICE
Invoice # LD-2024-1000105683
Invoice Date Aug 27, 2024
Invoice Amount €63.98 (EUR)
DESCRIPTION RENTALS VAT % AMOUNT (EUR)
Starter 10 20 % €53.32
Total excl. VAT €53.32
VAT @ 20 % €10.66
Total €63.98`,
      expected: { vendor: 'Lodgify', amount: 63.98, currency: 'EUR', invoice_number: 'LD-2024-1000105683' }
    },
    {
      name: 'M&M Windows Invoice',
      text: `M&M Windows (SW) Ltd
SALES INVOICE
Invoice Date 18/12/2024
Invoice Number SI-750
Code Description Qty/Hrs Price VAT % Net
Doors To supply and install a new white UPVC door 1.00 1,110.00 20.00 1,110.00
Total Net 1,110.00
Total VAT 222.00
TOTAL £1,332.00`,
      expected: { vendor: 'M&M Windows', amount: 1332.00, currency: 'GBP', invoice_number: 'SI-750' }
    },
    {
      name: 'British Gas Bill',
      text: `British Gas
Bill date: 20 October 2023
Bill number: 827262908
Your business electricity bill
Total amount due £1,429.22
New charges this bill £310.61
Electricity charges £255.24
Standing charges £40.58
VAT £14.79`,
      expected: { vendor: 'British Gas', amount: 1429.22, currency: 'GBP', invoice_number: '827262908' }
    }
  ];
  
  for (const sample of sampleTexts) {
    console.log(`${colors.blue('→')} ${colors.bold(sample.name)}`);
    
    // Test pattern extraction
    const patterns = testPatternExtraction(sample.text);
    
    console.log(`    Vendor: ${patterns.vendor || colors.yellow('(not found)')}`);
    console.log(`    Amount: ${patterns.amount !== null ? formatCurrency(patterns.amount, patterns.currency) : colors.yellow('(not found)')}`);
    console.log(`    Invoice #: ${patterns.invoiceNumber || colors.yellow('(not found)')}`);
    console.log(`    Date: ${patterns.date || colors.yellow('(not found)')}`);
    
    // Check matches
    const vendorMatch = patterns.vendor?.toLowerCase().includes(sample.expected.vendor.toLowerCase());
    const amountMatch = patterns.amount !== null && Math.abs(patterns.amount - sample.expected.amount) < 0.01;
    const invoiceMatch = patterns.invoiceNumber === sample.expected.invoice_number;
    
    const status = vendorMatch && amountMatch && invoiceMatch 
      ? colors.green('✓ All fields match')
      : colors.yellow('⚠ Some fields missing/incorrect');
    console.log(`    ${status}\n`);
  }
}

function testPatternExtraction(text: string): {
  vendor: string | null;
  amount: number | null;
  currency: string | null;
  invoiceNumber: string | null;
  date: string | null;
} {
  const result = {
    vendor: null as string | null,
    amount: null as number | null,
    currency: null as string | null,
    invoiceNumber: null as string | null,
    date: null as string | null,
  };
  
  // --- VENDOR EXTRACTION ---
  // Try common patterns: first line with company name, "From:", "Billed by:", company at top
  const vendorPatterns = [
    /^([A-Z][A-Za-z\s&]+(?:Ltd|Limited|Inc|LLC|LLP|PLC)?)/m,
    /(?:From|Billed by|Supplier|Vendor)[:\s]+([^\n]+)/i,
    /^([A-Z][A-Za-z\s]+)\n/m,
  ];
  
  for (const pattern of vendorPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].trim().length > 2) {
      result.vendor = match[1].trim();
      break;
    }
  }
  
  // --- AMOUNT EXTRACTION ---
  // Look for total amounts with currency symbols
  const amountPatterns = [
    /Invoice\s*Amount\s*[€£$]?\s*([\d,]+\.?\d+)\s*\(?(EUR|GBP|USD)?\)?/i, // Lodgify format
    /Total\s*amount\s*due[:\s]*[€£$]?\s*([\d,]+\.?\d+)/i, // Utility bill format
    /(?:Total|TOTAL|Amount Due|Invoice Amount|Invoice Total)[:\s]*[€£$]?\s*([\d,]+\.?\d+)\s*(?:\(?(EUR|GBP|USD)?\)?)?/i,
    /(?:Total amount due|Amount due)[:\s]*[€£$]?\s*([\d,]+\.?\d+)/i,
    /[€£$]\s*([\d,]+\.?\d+)/g, // Fallback: find any currency amount
  ];
  
  // Detect currency from text
  if (text.includes('€') || text.includes('EUR')) result.currency = 'EUR';
  else if (text.includes('£') || text.includes('GBP')) result.currency = 'GBP';
  else result.currency = 'USD';
  
  for (const pattern of amountPatterns) {
    if (pattern.global) {
      // For global patterns, find the largest amount (likely total)
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        const amounts = matches.map(m => parseFloat(m[1].replace(/,/g, ''))).filter(a => !isNaN(a));
        if (amounts.length > 0) {
          result.amount = Math.max(...amounts);
        }
      }
    } else {
      const match = text.match(pattern);
      if (match && match[1]) {
        result.amount = parseFloat(match[1].replace(/,/g, ''));
        if (match[2]) result.currency = match[2];
        break;
      }
    }
  }
  
  // --- INVOICE NUMBER EXTRACTION ---
  const invoicePatterns = [
    /Invoice\s*#\s*(LD-\d{4}-\d+)/i, // Lodgify format
    /Invoice\s*#?\s*[:# ]?\s*([A-Z]{0,3}[-\d]+[-\d]*)/i,
    /Bill\s*(?:number|no\.?|#)\s*[:# ]?\s*(\d+)/i,
    /Invoice\s*(?:Number|No\.?|ID)\s*[:# ]?\s*([A-Z0-9-]+)/i,
    /(?:Ref|Reference)\s*[:# ]?\s*([A-Z0-9-]+)/i,
  ];
  
  for (const pattern of invoicePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.invoiceNumber = match[1].trim();
      break;
    }
  }
  
  // --- DATE EXTRACTION ---
  const datePatterns = [
    /Invoice\s*Date\s+(\w+\s+\d{1,2},?\s+\d{4})/i, // Lodgify format: "Invoice Date Aug 27, 2024"
    /Bill\s*date[:\s]+(\d{1,2}\s+\w+\s+\d{4})/i, // Utility bill format: "Bill date: 20 October 2023"
    /(?:Invoice Date|Bill date|Date)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(?:Invoice Date|Bill date|Date)[:\s]*(\w+\s+\d{1,2},?\s+\d{4})/i,
    /(?:Invoice Date|Bill date|Date)[:\s]*(\d{1,2}\s+\w+\s+\d{4})/i,
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.date = match[1].trim();
      break;
    }
  }
  
  return result;
}

async function main(): Promise<void> {
  console.log(colors.bold('\n╔══════════════════════════════════════════╗'));
  console.log(colors.bold('║     INVOICE OCR EXTRACTION TESTER        ║'));
  console.log(colors.bold('╚══════════════════════════════════════════╝'));
  
  // Check OCR configuration
  const ocrConfigured = await testOCRConfiguration();
  
  // Get invoice paths from command line or use defaults
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    // Process provided invoice files
    console.log('\n' + colors.bold('Processing provided invoice files...'));
    await runTests(args);
  } else {
    // No files provided - run simulation with sample text
    console.log(colors.gray('\nNo invoice files provided. Running pattern extraction test with sample text.'));
    console.log(colors.gray('Usage: pnpm tsx scripts/test-invoice-ocr.ts <invoice1.pdf> <invoice2.pdf> ...'));
    
    await simulateWithSampleText();
    
    if (ocrConfigured) {
      console.log(colors.blue('\nTo test with actual files, provide paths as arguments:'));
      console.log(colors.gray('  pnpm tsx scripts/test-invoice-ocr.ts ~/Downloads/lodgify_invoice.pdf'));
    }
  }
}

main().catch(console.error);

