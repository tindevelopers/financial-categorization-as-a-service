import * as XLSX from "xlsx";
import { TransactionMergeService, createMergeService } from "@/lib/sync/TransactionMergeService";
import type { Transaction as SyncTransaction } from "@/lib/sync/types";
import { generateTransactionFingerprint } from "@/lib/sync/fingerprint";

export interface Transaction {
  date: Date | string;
  description: string;
  amount: number;
  transaction_type?: 'debit' | 'credit' | 'interest' | 'fee' | 'transfer' | 'deposit' | 'withdrawal' | 'payment' | 'refund';
  is_debit?: boolean;
  posted_date?: Date | string;
  reference_number?: string;
  merchant_category_code?: string;
  running_balance?: number;
}

export interface CategorizedTransaction extends Transaction {
  category?: string;
  subcategory?: string;
  confidenceScore?: number;
}

export interface ProcessResult {
  success: boolean;
  transactionCount?: number;
  insertedCount?: number;
  skippedCount?: number;
  duplicateDetails?: Array<{
    fingerprint: string;
    existingTransactionId?: string;
    matchType: "exact" | "similar";
    similarity: number;
  }>;
  error?: string;
}

/**
 * Find a value in a row by matching column names case-insensitively
 * @param row - The row object with column headers as keys
 * @param patterns - Array of patterns to match (case-insensitive, supports partial matching)
 * @returns The value if found, undefined otherwise
 */
function findColumnValue(row: any, patterns: string[]): any {
  const rowKeys = Object.keys(row);
  
  for (const pattern of patterns) {
    const patternLower = pattern.toLowerCase();
    for (const key of rowKeys) {
      const keyLower = key.toLowerCase();
      // Exact match or pattern is contained in key
      if (keyLower === patternLower || keyLower.includes(patternLower)) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
          return row[key];
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Extract transactions from spreadsheet data
 * Supports various bank statement formats with case-insensitive column matching
 */
export function extractTransactions(data: any[]): Transaction[] {
  const transactions: Transaction[] = [];

  // Extended column name patterns for various bank formats
  // These are checked case-insensitively and with partial matching
  const datePatterns = [
    "date",
    "transaction_date",
    "trans_date",
    "posted_date",
    "post_date",
    "date_posted",
    "value_date",
    "entry_date",
    "effective_date",
    "txn_date",
    "trans date",
    "posted date",
    "value date",
    "entry date",
  ];
  
  const descPatterns = [
    "description",
    "memo",
    "details",
    "transaction",
    "merchant",
    "payee",
    "narrative",
    "reference",
    "particulars",
    "remarks",
    "name",
    "party",
    "counterparty",
    "trans details",
    "transaction details",
    "payment details",
  ];
  
  const amountPatterns = [
    "amount",
    "debit",
    "credit",
    "transaction_amount",
    "trans_amount",
    "paid_out",
    "paid_in",
    "money_out",
    "money_in",
    "debit_amount",
    "credit_amount",
    "withdrawal",
    "deposit",
    "value",
    "sum",
    "paid out",
    "paid in",
    "money out",
    "money in",
    "debit amount",
    "credit amount",
  ];

  const balancePatterns = [
    "balance",
    "running_balance",
    "running balance",
    "account_balance",
    "account balance",
    "closing_balance",
    "closing balance",
  ];

  const referencePatterns = [
    "reference",
    "ref",
    "reference_number",
    "reference number",
    "ref_no",
    "ref no",
    "check_no",
    "check no",
    "chq_no",
    "chq no",
    "transaction_id",
    "transaction id",
    "txn_id",
    "txn id",
  ];

  const typePatterns = [
    "type",
    "transaction_type",
    "transaction type",
    "txn_type",
    "txn type",
  ];

  for (const row of data) {
    let date: Date | string | null = null;
    let postedDate: Date | string | null = null;
    let description: string | null = null;
    let amount: number | null = null;
    let transactionType: Transaction['transaction_type'] | null = null;
    let referenceNumber: string | null = null;
    let runningBalance: number | null = null;

    // Find date using extended patterns
    const dateValue = findColumnValue(row, datePatterns);
    if (dateValue) {
      date = parseDate(dateValue);
    }
    if (!date) {
      // Try first column if it looks like a date
      const firstKey = Object.keys(row)[0];
      if (firstKey && isDateLike(row[firstKey])) {
        date = parseDate(row[firstKey]);
      }
    }

    // Find posted date (may differ from transaction date)
    const postedDateValue = findColumnValue(row, ["posted_date", "post_date", "date_posted", "cleared_date", "cleared date"]);
    if (postedDateValue) {
      postedDate = parseDate(postedDateValue);
    }

    // Find description using extended patterns
    const descValue = findColumnValue(row, descPatterns);
    if (descValue && typeof descValue === "string") {
      description = descValue.trim();
    }
    if (!description) {
      // Try second column as fallback
      const keys = Object.keys(row);
      if (keys.length > 1) {
        const secondVal = row[keys[1]];
        if (secondVal && typeof secondVal === "string") {
          description = secondVal.trim();
        }
      }
    }

    // Extract reference number from description or dedicated column
    if (description) {
      const refFromDesc = extractReferenceFromDescription(description);
      if (refFromDesc) {
        referenceNumber = refFromDesc;
      }
    }
    
    // Try dedicated reference column
    const refValue = findColumnValue(row, referencePatterns);
    if (refValue && typeof refValue === "string") {
      referenceNumber = refValue.trim();
    }

    // Find transaction type from dedicated column
    const typeValue = findColumnValue(row, typePatterns);
    if (typeValue && typeof typeValue === "string") {
      transactionType = classifyTransactionTypeFromString(typeValue.toLowerCase());
    }

    // Find running balance
    const balanceValue = findColumnValue(row, balancePatterns);
    if (balanceValue !== undefined) {
      runningBalance = parseAmount(balanceValue);
    }

    // Find amount using extended patterns
    // Try debit/credit columns separately first (common in bank statements)
    const rowKeys = Object.keys(row);
    let debitAmount: number | null = null;
    let creditAmount: number | null = null;
    
    // Look for separate debit/credit columns
    for (const key of rowKeys) {
      const keyLower = key.toLowerCase();
      if (keyLower.includes("debit") || keyLower.includes("paid out") || 
          keyLower.includes("money out") || keyLower.includes("withdrawal")) {
        const val = parseAmount(row[key]);
        if (val !== null && val !== 0) {
          debitAmount = Math.abs(val);
          if (!transactionType) {
            transactionType = 'debit';
          }
        }
      }
      if (keyLower.includes("credit") || keyLower.includes("paid in") || 
          keyLower.includes("money in") || keyLower.includes("deposit")) {
        const val = parseAmount(row[key]);
        if (val !== null && val !== 0) {
          creditAmount = Math.abs(val);
          if (!transactionType) {
            transactionType = 'credit';
          }
        }
      }
    }
    
    // If we found debit or credit, use them (debit as negative, credit as positive)
    if (debitAmount !== null && debitAmount !== 0) {
      amount = -debitAmount; // Outflow is negative
    } else if (creditAmount !== null && creditAmount !== 0) {
      amount = creditAmount; // Inflow is positive
    } else {
      // Try generic amount column
      const amountValue = findColumnValue(row, amountPatterns);
      if (amountValue !== undefined) {
        amount = parseAmount(amountValue);
      }
    }
    
    if (amount === null) {
      // Try last column as fallback
      const keys = Object.keys(row);
      if (keys.length > 0) {
        amount = parseAmount(row[keys[keys.length - 1]]);
      }
    }

    // Classify transaction type if not already set
    if (!transactionType && description && amount !== null) {
      transactionType = classifyTransactionTypeFromDescription(description, amount);
    }

    // Determine is_debit based on transaction type and amount
    let is_debit: boolean | undefined;
    if (transactionType) {
      const debitTypes: Array<typeof transactionType> = ['debit', 'withdrawal', 'payment', 'fee'];
      is_debit = debitTypes.includes(transactionType);
    } else if (amount !== null) {
      is_debit = amount < 0;
    }

    // Normalize amount (make positive, use is_debit flag)
    let normalizedAmount = amount;
    if (amount !== null && is_debit && amount > 0) {
      // If it's a debit but amount is positive, keep positive (is_debit flag indicates direction)
      normalizedAmount = amount;
    } else if (amount !== null && !is_debit && amount < 0) {
      // If it's a credit but amount is negative, make positive
      normalizedAmount = Math.abs(amount);
    } else if (amount !== null) {
      normalizedAmount = Math.abs(amount);
    }

    // Only add if we have all required fields
    if (date && description && normalizedAmount !== null) {
      const transaction: Transaction = {
        date,
        description,
        amount: normalizedAmount,
      };

      if (transactionType) {
        transaction.transaction_type = transactionType;
      }
      if (is_debit !== undefined) {
        transaction.is_debit = is_debit;
      }
      if (postedDate) {
        transaction.posted_date = postedDate;
      }
      if (referenceNumber) {
        transaction.reference_number = referenceNumber;
      }
      if (runningBalance !== null) {
        transaction.running_balance = runningBalance;
      }

      transactions.push(transaction);
    }
  }

  return transactions;
}

function parseDate(value: any): Date | string | null {
  if (value instanceof Date) {
    return value;
  }
  
  if (typeof value === "string") {
    // Try parsing common date formats
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0]; // Return YYYY-MM-DD format
    }
  }
  
  if (typeof value === "number") {
    // Excel date serial number
    // Try parsing as Excel date (days since Jan 1, 1900)
    try {
      const excelEpoch = new Date(1899, 11, 30);
      const excelDate = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
      if (!isNaN(excelDate.getTime()) && excelDate.getFullYear() > 1900 && excelDate.getFullYear() < 2100) {
        return excelDate.toISOString().split("T")[0];
      }
    } catch {
      // Not a valid Excel date
    }
  }
  
  return null;
}

function parseAmount(value: any): number | null {
  if (typeof value === "number") {
    return value;
  }
  
  if (typeof value === "string") {
    // Remove currency symbols and commas
    const cleaned = value.replace(/[$,€£¥]/g, "").replace(/,/g, "").trim();
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  
  return null;
}

function isDateLike(value: any): boolean {
  if (value instanceof Date) return true;
  if (typeof value === "string") {
    return /^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}/.test(value);
  }
  return false;
}

/**
 * Extract reference number from description text
 */
function extractReferenceFromDescription(description: string): string | null {
  const patterns = [
    /ref[:\s]+([A-Z0-9-]+)/i,
    /reference[:\s]+([A-Z0-9-]+)/i,
    /ref\s+no[:\s]+([A-Z0-9-]+)/i,
    /check\s+no[:\s]+([0-9]+)/i,
    /chq\s+no[:\s]+([0-9]+)/i,
    /transaction\s+id[:\s]+([A-Z0-9-]+)/i,
    /txn[:\s]+([A-Z0-9-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Classify transaction type from a type string
 */
function classifyTransactionTypeFromString(typeStr: string): Transaction['transaction_type'] | null {
  const normalized = typeStr.toLowerCase().trim();
  
  if (normalized.includes('debit') || normalized.includes('withdrawal') || normalized.includes('payment')) {
    return 'debit';
  }
  if (normalized.includes('credit') || normalized.includes('deposit')) {
    return 'credit';
  }
  if (normalized.includes('interest')) {
    return 'interest';
  }
  if (normalized.includes('fee') || normalized.includes('charge')) {
    return 'fee';
  }
  if (normalized.includes('transfer')) {
    return 'transfer';
  }
  if (normalized.includes('refund')) {
    return 'refund';
  }
  
  return null;
}

/**
 * Classify transaction type from description and amount
 */
function classifyTransactionTypeFromDescription(
  description: string,
  amount: number
): Transaction['transaction_type'] {
  const descLower = description.toLowerCase();

  // Interest payments/receipts
  if (descLower.includes('interest') || descLower.includes('int ')) {
    return 'interest';
  }

  // Fees
  if (
    descLower.includes('fee') ||
    descLower.includes('charge') ||
    descLower.includes('overdraft') ||
    descLower.includes('maintenance') ||
    descLower.includes('service charge')
  ) {
    return 'fee';
  }

  // Refunds
  if (
    descLower.includes('refund') ||
    descLower.includes('reversal') ||
    descLower.includes('chargeback')
  ) {
    return 'refund';
  }

  // Transfers
  if (
    descLower.includes('transfer') ||
    descLower.includes('internal transfer') ||
    descLower.includes('online transfer')
  ) {
    return 'transfer';
  }

  // Deposits
  if (
    descLower.includes('deposit') ||
    descLower.includes('credit') ||
    descLower.includes('payment received')
  ) {
    return 'deposit';
  }

  // Withdrawals
  if (
    descLower.includes('withdrawal') ||
    descLower.includes('cash withdrawal') ||
    descLower.includes('atm')
  ) {
    return 'withdrawal';
  }

  // Payments
  if (
    descLower.includes('payment') ||
    descLower.includes('direct debit') ||
    descLower.includes('standing order') ||
    descLower.includes('card payment')
  ) {
    return 'payment';
  }

  // Default based on amount sign
  return amount < 0 ? 'debit' : 'credit';
}

/**
 * Categorize transactions using AI or rule-based fallback
 */
// Helper to conditionally log (only if debug server is available)
const debugLog = async (location: string, message: string, data: any) => {
  // Only log if explicitly enabled and in development
  if (process.env.ENABLE_DEBUG_LOGGING === 'true') {
    try {
      // Use platform logs (Vercel) instead of trying to call localhost from a serverless environment.
      console.debug("[process-spreadsheet]", { location, message, data });
    } catch {
      // Ignore errors
    }
  }
};

export async function categorizeTransactions(
  transactions: Transaction[],
  userId: string,
  supabase: any
): Promise<CategorizedTransaction[]> {
  const useAIEnv = process.env.USE_AI_CATEGORIZATION === 'true';
  console.log('[DEBUG] categorizeTransactions entry', {
    transactionCount: transactions.length,
    userId,
    useAI: useAIEnv,
    hasUseAIEnv: !!process.env.USE_AI_CATEGORIZATION,
    useAIEnvValue: process.env.USE_AI_CATEGORIZATION
  });
  
  await debugLog('process-spreadsheet.ts:164', 'categorizeTransactions entry', {
    transactionCount: transactions.length,
    userId,
    useAI: useAIEnv,
    hasUseAIEnv: !!process.env.USE_AI_CATEGORIZATION
  });
  
  // Get user's category mappings
  const { data: mappings } = await supabase
    .from("user_category_mappings")
    .select("*")
    .eq("user_id", userId);

  console.log('[DEBUG] User mappings fetched', {
    mappingsCount: mappings?.length || 0,
    userId
  });

  await debugLog('process-spreadsheet.ts:172', 'User mappings fetched', {
    mappingsCount: mappings?.length || 0
  });

  // Use AI categorization service if available
  const useAI = process.env.USE_AI_CATEGORIZATION === "true";
  
  console.log('[DEBUG] AI categorization check', {
    useAI,
    envVarValue: process.env.USE_AI_CATEGORIZATION,
    willUseAI: useAI
  });
  
  if (useAI) {
    try {
      console.log('[DEBUG] AI categorization enabled, importing factory');
      await debugLog('process-spreadsheet.ts:179', 'AI categorization enabled, importing factory', {});
      
      const { AICategorizationFactory } = await import("@/lib/ai/AICategorizationFactory");
      const { VercelAICategorizationService } = await import("@/lib/ai/VercelAICategorizationService");
      const provider = AICategorizationFactory.getDefaultProvider();
      
      console.log('[DEBUG] AI factory imported', { provider });
      await debugLog('process-spreadsheet.ts:185', 'AI factory imported', { provider });
      
      // Get company profile ID if available
      const { data: companyProfile } = await supabase
        .from("company_profiles")
        .select("id")
        .eq("user_id", userId)
        .eq("setup_completed", true)
        .limit(1)
        .single();
      
      const companyProfileId = companyProfile?.id;
      
      // Load AI instructions
      const aiInstructions = await VercelAICategorizationService.loadCategorizationInstructions(
        supabase,
        userId,
        companyProfileId
      );
      
      console.log('[DEBUG] AI instructions loaded', {
        hasSystemPrompt: !!aiInstructions.systemPrompt,
        hasCategoryRules: !!aiInstructions.categoryRules,
        hasExceptionRules: !!aiInstructions.exceptionRules,
        companyProfileId
      });
      
      const userMappings = mappings?.map((m: any) => ({
        pattern: m.pattern,
        category: m.category,
        subcategory: m.subcategory || undefined,
      }));
      
      const aiService = AICategorizationFactory.create(
        provider,
        userMappings,
        aiInstructions,
        companyProfileId
      );
      
      console.log('[DEBUG] AI service created', { hasService: !!aiService, provider });
      await debugLog('process-spreadsheet.ts:194', 'AI service created', { hasService: !!aiService });
      
      // Convert transactions to AI service format (include transaction type and other metadata)
      const aiTransactions = transactions.map(tx => ({
        original_description: tx.description,
        amount: tx.amount,
        date: typeof tx.date === "string" ? tx.date : tx.date.toISOString().split("T")[0],
        transaction_type: tx.transaction_type,
        is_debit: tx.is_debit,
        reference_number: tx.reference_number,
        posted_date: tx.posted_date ? (typeof tx.posted_date === "string" ? tx.posted_date : tx.posted_date.toISOString().split("T")[0]) : undefined,
      }));

      // Categorize in batches (process 20 at a time to avoid token limits)
      const BATCH_SIZE = 20;
      const results: CategorizedTransaction[] = [];
      const totalBatches = Math.ceil(aiTransactions.length / BATCH_SIZE);
      
      console.log('[DEBUG] Starting AI categorization batches', {
        totalTransactions: aiTransactions.length,
        batchSize: BATCH_SIZE,
        totalBatches
      });
      
      for (let i = 0; i < aiTransactions.length; i += BATCH_SIZE) {
        const batch = aiTransactions.slice(i, i + BATCH_SIZE);
        
        console.log('[DEBUG] Calling AI categorizeBatch', {
          batchIndex: i,
          batchSize: batch.length,
          batchNumber: Math.floor(i / BATCH_SIZE) + 1,
          totalBatches
        });
        await debugLog('process-spreadsheet.ts:207', 'Calling AI categorizeBatch', {
          batchIndex: i,
          batchSize: batch.length,
          totalBatches
        });
        
        const batchResults = await aiService.categorizeBatch(batch);
        
        console.log('[DEBUG] AI categorizeBatch completed', {
          batchIndex: i,
          resultsCount: batchResults.length,
          hasResults: batchResults.length > 0,
          sampleResult: batchResults[0] ? {
            category: batchResults[0].category,
            subcategory: batchResults[0].subcategory,
            confidenceScore: batchResults[0].confidenceScore
          } : null
        });
        await debugLog('process-spreadsheet.ts:211', 'AI categorizeBatch completed', {
          resultsCount: batchResults.length,
          hasResults: batchResults.length > 0
        });
        
        // Merge results back with original transactions
        for (let j = 0; j < batch.length; j++) {
          const originalTx = transactions[i + j];
          const aiResult = batchResults[j];
          // Handle case where AI returns fewer results than batch size
          if (aiResult) {
            results.push({
              ...originalTx,
              category: aiResult.category,
              subcategory: aiResult.subcategory,
              confidenceScore: aiResult.confidenceScore,
            });
          } else {
            // Fallback for missing AI result
            results.push({
              ...originalTx,
              category: "Uncategorized",
              subcategory: undefined,
              confidenceScore: 0.3,
            });
          }
        }
      }
      
      console.log('[DEBUG] AI categorization completed successfully', {
        totalResults: results.length,
        categorizedCount: results.filter(r => r.category && r.category !== 'Uncategorized').length
      });
      await debugLog('process-spreadsheet.ts:226', 'AI categorization completed successfully', {
        totalResults: results.length
      });
      
      return results;
    } catch (error: any) {
      console.log('[DEBUG] AI categorization failed, falling back to rule-based', {
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack?.substring(0, 500) || null
      });
      await debugLog('process-spreadsheet.ts:230', 'AI categorization failed, falling back', {
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack?.substring(0, 500) || null
      });
      console.error("AI categorization failed, falling back to rule-based:", error);
      // Fall through to rule-based categorization
    }
  } else {
    console.log('[DEBUG] AI categorization disabled, using rule-based', {
      useAIEnv: process.env.USE_AI_CATEGORIZATION
    });
  }

  // Basic rule-based categorization (fallback)
  return transactions.map(tx => {
    let category: string | undefined;
    let subcategory: string | undefined;
    let confidenceScore = 0.5;

    // Check user mappings first
    if (mappings && mappings.length > 0) {
      for (const mapping of mappings) {
        const pattern = mapping.pattern.toLowerCase();
        const description = tx.description.toLowerCase();

        if (description.includes(pattern)) {
          category = mapping.category;
          subcategory = mapping.subcategory || undefined;
          confidenceScore = 0.9; // High confidence for user-defined mappings
          break;
        }
      }
    }

    // If no mapping found, use basic keyword matching
    if (!category) {
      const desc = tx.description.toLowerCase();
      
      // Common expense categories
      if (desc.includes("grocery") || desc.includes("supermarket") || desc.includes("food")) {
        category = "Food & Dining";
        subcategory = "Groceries";
        confidenceScore = 0.7;
      } else if (desc.includes("restaurant") || desc.includes("cafe") || desc.includes("dining")) {
        category = "Food & Dining";
        subcategory = "Restaurants";
        confidenceScore = 0.7;
      } else if (desc.includes("gas") || desc.includes("fuel") || desc.includes("petrol")) {
        category = "Transportation";
        subcategory = "Gas & Fuel";
        confidenceScore = 0.7;
      } else if (desc.includes("parking") || desc.includes("toll") || desc.includes("uber") || desc.includes("lyft")) {
        category = "Transportation";
        subcategory = "Other";
        confidenceScore = 0.6;
      } else if (desc.includes("amazon") || desc.includes("walmart") || desc.includes("target")) {
        category = "Shopping";
        subcategory = "General";
        confidenceScore = 0.7;
      } else if (desc.includes("utility") || desc.includes("electric") || desc.includes("water") || desc.includes("internet")) {
        category = "Utilities";
        subcategory = "General";
        confidenceScore = 0.7;
      } else {
        category = "Uncategorized";
        confidenceScore = 0.3;
      }
    }

    return {
      ...tx,
      category,
      subcategory,
      confidenceScore,
    };
  });
}

/**
 * Process a spreadsheet file and return categorized transactions
 * Uses TransactionMergeService for duplicate detection
 * @param adminClient - Optional admin client for inserts (bypasses RLS)
 */
export async function processSpreadsheetFile(
  fileBuffer: ArrayBuffer,
  jobId: string,
  userId: string,
  supabase: any,
  adminClient?: any
): Promise<ProcessResult> {
  await debugLog('process-spreadsheet.ts:294', 'processSpreadsheetFile entry', {
    jobId,
    userId,
    fileSize: fileBuffer.byteLength
  });
  
  try {
    // Get tenant_id for the user
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", userId)
      .single();

    // Get bank_account_id and any extracted date range from job
    const { data: jobData } = await supabase
      .from("categorization_jobs")
      .select("bank_account_id, extracted_date_start, extracted_date_end")
      .eq("id", jobId)
      .single();

    const bankAccountId = jobData?.bank_account_id || null;
    const extractedDateStart = jobData?.extracted_date_start as string | null | undefined;
    const extractedDateEnd = jobData?.extracted_date_end as string | null | undefined;

    await debugLog('process-spreadsheet.ts:315', 'Job data fetched', {
      hasJobData: !!jobData,
      bankAccountId
    });

    // Parse spreadsheet
    const workbook = XLSX.read(fileBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    await debugLog('process-spreadsheet.ts:323', 'Spreadsheet parsed', {
      sheetName,
      rowCount: data.length
    });

    // Extract transactions
    const transactions = extractTransactions(data);

    await debugLog('process-spreadsheet.ts:327', 'Transactions extracted', {
      transactionCount: transactions.length
    });

    if (transactions.length === 0) {
      return {
        success: false,
        error: "No transactions found in spreadsheet",
      };
    }

    // Convert to sync transaction format
    const syncTransactions: SyncTransaction[] = transactions.map(tx => ({
      original_description: tx.description,
      amount: tx.amount,
      date: typeof tx.date === "string" ? tx.date : tx.date.toISOString().split("T")[0],
      category: undefined,
      subcategory: undefined,
    }));

    // Use TransactionMergeService for duplicate detection and insertion
    // Use admin client if provided to bypass RLS for inserts
    const clientForInserts = adminClient || supabase;
    const mergeService = createMergeService(clientForInserts, userId, userData?.tenant_id || null);
    
    // Categorize transactions first
    await debugLog('process-spreadsheet.ts:346', 'Starting categorization', {
      transactionCount: transactions.length
    });
    
    const categorizedTransactions = await categorizeTransactions(
      transactions,
      userId,
      supabase
    );

    await debugLog('process-spreadsheet.ts:353', 'Categorization completed', {
      categorizedCount: categorizedTransactions.length
    });

    // Map categorized transactions back to sync format
    const categorizedSyncTransactions: SyncTransaction[] = syncTransactions.map((tx, index) => {
      const categorized = categorizedTransactions[index];
      return {
        ...tx,
        category: categorized.category,
        subcategory: categorized.subcategory,
        confidence_score: categorized.confidenceScore,
      };
    });

    // Determine statement period (prefer filename-extracted range; fallback to min/max tx dates)
    const txDates = categorizedSyncTransactions
      .map((t) => (typeof t.date === "string" ? t.date : t.date.toISOString().split("T")[0]))
      .filter(Boolean)
      .sort();
    const minTxDate = txDates[0];
    const maxTxDate = txDates[txDates.length - 1];

    const periodStart = extractedDateStart || minTxDate;
    const periodEnd = extractedDateEnd || maxTxDate;

    // Persist computed period back to job if missing
    try {
      const clientForJobUpdate = adminClient || supabase;
      const updatePayload: Record<string, string> = {};
      if (!extractedDateStart && periodStart) updatePayload.extracted_date_start = periodStart;
      if (!extractedDateEnd && periodEnd) updatePayload.extracted_date_end = periodEnd;
      if (Object.keys(updatePayload).length > 0) {
        await clientForJobUpdate.from("categorization_jobs").update(updatePayload).eq("id", jobId);
      }
    } catch {
      // Non-fatal
    }

    // Replace-by-period: delete existing transactions for this bank account within the statement period
    if (bankAccountId && periodStart && periodEnd) {
      const clientForDeletes = adminClient || supabase;
      try {
        // Find all jobs for this user+bank account
        const { data: jobsForAccount } = await clientForDeletes
          .from("categorization_jobs")
          .select("id")
          .eq("user_id", userId)
          .eq("bank_account_id", bankAccountId);

        const jobIds = (jobsForAccount || []).map((j: any) => j.id).filter(Boolean);
        if (jobIds.length > 0) {
          // Batch deletes (avoid very large IN lists)
          const CHUNK = 200;
          for (let i = 0; i < jobIds.length; i += CHUNK) {
            const chunk = jobIds.slice(i, i + CHUNK);
            await clientForDeletes
              .from("categorized_transactions")
              .delete()
              .in("job_id", chunk)
              .gte("date", periodStart)
              .lte("date", periodEnd);
          }
        }
      } catch (e) {
        console.warn("Replace-by-period deletion failed (continuing with insert):", e);
      }
    }

    // De-dupe within the upload itself (prevents duplicates if the spreadsheet repeats a row)
    const seen = new Set<string>();
    let intraFileDuplicates = 0;
    const uniqueCategorizedSyncTransactions: SyncTransaction[] = [];
    for (const tx of categorizedSyncTransactions) {
      const dateStr = typeof tx.date === "string" ? tx.date : tx.date.toISOString().split("T")[0];
      const fp =
        tx.transaction_fingerprint ||
        generateTransactionFingerprint(tx.original_description, tx.amount, dateStr);
      if (seen.has(fp)) {
        intraFileDuplicates++;
        continue;
      }
      seen.add(fp);
      uniqueCategorizedSyncTransactions.push({
        ...tx,
        transaction_fingerprint: fp,
      });
    }

    // Process with merge service (handles duplicate detection)
    console.log('[DEBUG] Starting merge service', {
      syncTransactionCount: uniqueCategorizedSyncTransactions.length,
      jobId,
      bankAccountId,
      categorizedCount: uniqueCategorizedSyncTransactions.filter(tx => tx.category).length
    });
    await debugLog('process-spreadsheet.ts:365', 'Starting merge service', {
      syncTransactionCount: categorizedSyncTransactions.length
    });
    
    // For period-replace uploads, we intentionally skip global duplicate detection (we already deleted by period).
    const mergeResult = await mergeService.processUploadWithMerge(uniqueCategorizedSyncTransactions, {
      sourceType: "upload",
      sourceIdentifier: `job_${jobId}`,
      jobId: jobId,
      createJob: false,
      skipDuplicateCheck: true,
      bankAccountId: bankAccountId,
    });

    console.log('[DEBUG] Merge service completed', {
      inserted: mergeResult.inserted,
      skipped: mergeResult.skipped,
      updated: mergeResult.updated,
      mode: mergeResult.mode,
      message: mergeResult.message,
      jobId
    });
    await debugLog('process-spreadsheet.ts:375', 'Merge service completed', {
      inserted: mergeResult.inserted,
      skipped: mergeResult.skipped
    });

    // Update job with item counts
    await supabase
      .from("categorization_jobs")
      .update({
        total_items: uniqueCategorizedSyncTransactions.length,
        processed_items: mergeResult.inserted,
        failed_items: intraFileDuplicates,
      })
      .eq("id", jobId);

    // Build duplicate details for response
    const duplicateDetails: Array<{
      fingerprint: string;
      existingTransactionId?: string;
      matchType: "exact" | "similar";
      similarity: number;
    }> = [];

    // Get duplicate details from merge result
    if (mergeResult.skipped > 0) {
      // We can't get exact duplicate details from merge result, but we can indicate duplicates were found
      duplicateDetails.push({
        fingerprint: "multiple",
        matchType: "exact",
        similarity: mergeResult.similarityScore || 0,
      });
    }

    return {
      success: true,
      transactionCount: uniqueCategorizedSyncTransactions.length,
      insertedCount: mergeResult.inserted,
      skippedCount: intraFileDuplicates,
      duplicateDetails: duplicateDetails.length > 0 ? duplicateDetails : undefined,
    };
  } catch (error: any) {
    await debugLog('process-spreadsheet.ts:407', 'processSpreadsheetFile error', {
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack?.substring(0, 1000) || null
    });
    console.error("Process spreadsheet error:", error);
    return {
      success: false,
      error: error.message || "Failed to process spreadsheet",
    };
  }
}

