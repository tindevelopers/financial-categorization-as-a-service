import * as XLSX from "xlsx";
import { TransactionMergeService, createMergeService } from "@/lib/sync/TransactionMergeService";
import type { Transaction as SyncTransaction } from "@/lib/sync/types";

export interface Transaction {
  date: Date | string;
  description: string;
  amount: number;
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
 * Extract transactions from spreadsheet data
 */
export function extractTransactions(data: any[]): Transaction[] {
  const transactions: Transaction[] = [];

  for (const row of data) {
    // Try to find date, description, and amount columns
    // Common column names to check
    const dateKeys = ["date", "transaction_date", "posted_date", "date_posted"];
    const descKeys = ["description", "memo", "details", "transaction", "merchant", "payee"];
    const amountKeys = ["amount", "debit", "credit", "transaction_amount"];

    let date: Date | string | null = null;
    let description: string | null = null;
    let amount: number | null = null;

    // Find date
    for (const key of dateKeys) {
      if (row[key]) {
        date = parseDate(row[key]);
        break;
      }
    }
    if (!date) {
      // Try first column if it looks like a date
      const firstKey = Object.keys(row)[0];
      if (firstKey && isDateLike(row[firstKey])) {
        date = parseDate(row[firstKey]);
      }
    }

    // Find description
    for (const key of descKeys) {
      if (row[key] && typeof row[key] === "string") {
        description = row[key].trim();
        break;
      }
    }
    if (!description) {
      // Try second column
      const keys = Object.keys(row);
      if (keys.length > 1) {
        description = String(row[keys[1]] || "").trim();
      }
    }

    // Find amount
    for (const key of amountKeys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
        amount = parseAmount(row[key]);
        if (amount !== null) break;
      }
    }
    if (amount === null) {
      // Try last column
      const keys = Object.keys(row);
      if (keys.length > 0) {
        amount = parseAmount(row[keys[keys.length - 1]]);
      }
    }

    // Only add if we have all required fields
    if (date && description && amount !== null) {
      transactions.push({
        date,
        description,
        amount,
      });
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
 * Categorize transactions using AI or rule-based fallback
 */
// Helper to conditionally log (only if debug server is available)
const debugLog = async (location: string, message: string, data: any) => {
  // Only log if explicitly enabled and in development
  if (process.env.ENABLE_DEBUG_LOGGING === 'true') {
    try {
      await fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, message, data, timestamp: Date.now(), sessionId: 'debug-session', runId: 'ai-fix' }),
        signal: AbortSignal.timeout(100) // 100ms timeout to avoid hanging
      }).catch(() => {}); // Silently fail if server unavailable
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
  await debugLog('process-spreadsheet.ts:164', 'categorizeTransactions entry', {
    transactionCount: transactions.length,
    userId,
    useAI: process.env.USE_AI_CATEGORIZATION === 'true',
    hasUseAIEnv: !!process.env.USE_AI_CATEGORIZATION
  });
  
  // Get user's category mappings
  const { data: mappings } = await supabase
    .from("user_category_mappings")
    .select("*")
    .eq("user_id", userId);

  await debugLog('process-spreadsheet.ts:172', 'User mappings fetched', {
    mappingsCount: mappings?.length || 0
  });

  // Use AI categorization service if available
  const useAI = process.env.USE_AI_CATEGORIZATION === "true";
  
  if (useAI) {
    try {
      await debugLog('process-spreadsheet.ts:179', 'AI categorization enabled, importing factory', {});
      
      const { AICategorizationFactory } = await import("@/lib/ai/AICategorizationFactory");
      const provider = AICategorizationFactory.getDefaultProvider();
      
      await debugLog('process-spreadsheet.ts:185', 'AI factory imported', { provider });
      
      const userMappings = mappings?.map((m: any) => ({
        pattern: m.pattern,
        category: m.category,
        subcategory: m.subcategory || undefined,
      }));
      
      const aiService = AICategorizationFactory.create(provider, userMappings);
      
      await debugLog('process-spreadsheet.ts:194', 'AI service created', { hasService: !!aiService });
      
      // Convert transactions to AI service format
      const aiTransactions = transactions.map(tx => ({
        original_description: tx.description,
        amount: tx.amount,
        date: typeof tx.date === "string" ? tx.date : tx.date.toISOString().split("T")[0],
      }));

      // Categorize in batches (process 20 at a time to avoid token limits)
      const BATCH_SIZE = 20;
      const results: CategorizedTransaction[] = [];
      
      for (let i = 0; i < aiTransactions.length; i += BATCH_SIZE) {
        const batch = aiTransactions.slice(i, i + BATCH_SIZE);
        
        await debugLog('process-spreadsheet.ts:207', 'Calling AI categorizeBatch', {
          batchIndex: i,
          batchSize: batch.length,
          totalBatches: Math.ceil(aiTransactions.length / BATCH_SIZE)
        });
        
        const batchResults = await aiService.categorizeBatch(batch);
        
        await debugLog('process-spreadsheet.ts:211', 'AI categorizeBatch completed', {
          resultsCount: batchResults.length,
          hasResults: batchResults.length > 0
        });
        
        // Merge results back with original transactions
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
      }
      
      await debugLog('process-spreadsheet.ts:226', 'AI categorization completed successfully', {
        totalResults: results.length
      });
      
      return results;
    } catch (error: any) {
      await debugLog('process-spreadsheet.ts:230', 'AI categorization failed, falling back', {
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack?.substring(0, 500) || null
      });
      console.error("AI categorization failed, falling back to rule-based:", error);
      // Fall through to rule-based categorization
    }
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
 */
export async function processSpreadsheetFile(
  fileBuffer: ArrayBuffer,
  jobId: string,
  userId: string,
  supabase: any
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

    // Get bank_account_id from job
    const { data: jobData } = await supabase
      .from("categorization_jobs")
      .select("bank_account_id")
      .eq("id", jobId)
      .single();

    const bankAccountId = jobData?.bank_account_id || null;

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
    const mergeService = createMergeService(supabase, userId, userData?.tenant_id || null);
    
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
      };
    });

    // Process with merge service (handles duplicate detection)
    await debugLog('process-spreadsheet.ts:365', 'Starting merge service', {
      syncTransactionCount: categorizedSyncTransactions.length
    });
    
    const mergeResult = await mergeService.processUploadWithMerge(categorizedSyncTransactions, {
      sourceType: "upload",
      sourceIdentifier: `job_${jobId}`,
      jobId: jobId,
      createJob: false,
      skipDuplicateCheck: false,
      bankAccountId: bankAccountId,
    });

    await debugLog('process-spreadsheet.ts:375', 'Merge service completed', {
      inserted: mergeResult.inserted,
      skipped: mergeResult.skipped
    });

    // Update job with item counts
    await supabase
      .from("categorization_jobs")
      .update({
        total_items: transactions.length,
        processed_items: mergeResult.inserted,
        failed_items: mergeResult.skipped > 0 ? mergeResult.skipped : 0,
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
      transactionCount: transactions.length,
      insertedCount: mergeResult.inserted,
      skippedCount: mergeResult.skipped,
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

