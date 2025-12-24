import * as XLSX from "xlsx";

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
export async function categorizeTransactions(
  transactions: Transaction[],
  userId: string,
  supabase: any
): Promise<CategorizedTransaction[]> {
  // Get user's category mappings
  const { data: mappings } = await supabase
    .from("user_category_mappings")
    .select("*")
    .eq("user_id", userId);

  // Use AI categorization service if available
  const useAI = process.env.USE_AI_CATEGORIZATION === "true";
  
  if (useAI) {
    try {
      const { AICategorizationFactory } = await import("@/lib/ai/AICategorizationFactory");
      const provider = AICategorizationFactory.getDefaultProvider();
      const userMappings = mappings?.map(m => ({
        pattern: m.pattern,
        category: m.category,
        subcategory: m.subcategory || undefined,
      }));
      
      const aiService = AICategorizationFactory.create(provider, userMappings);
      
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
        const batchResults = await aiService.categorizeBatch(batch);
        
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
      
      return results;
    } catch (error: any) {
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
 */
export async function processSpreadsheetFile(
  fileBuffer: ArrayBuffer,
  jobId: string,
  userId: string,
  supabase: any
): Promise<{
  success: boolean;
  transactionCount?: number;
  error?: string;
}> {
  try {
    // Parse spreadsheet
    const workbook = XLSX.read(fileBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    // Extract transactions
    const transactions = extractTransactions(data);

    if (transactions.length === 0) {
      return {
        success: false,
        error: "No transactions found in spreadsheet",
      };
    }

    // Update job with total items
    await supabase
      .from("categorization_jobs")
      .update({ total_items: transactions.length })
      .eq("id", jobId);

    // Categorize transactions
    const categorizedTransactions = await categorizeTransactions(
      transactions,
      userId,
      supabase
    );

    // Insert categorized transactions
    const transactionsToInsert = categorizedTransactions.map(tx => ({
      job_id: jobId,
      original_description: tx.description,
      amount: tx.amount,
      date: tx.date,
      category: tx.category || null,
      subcategory: tx.subcategory || null,
      confidence_score: tx.confidenceScore || 0.5,
      user_confirmed: false,
    }));

    const { error: insertError } = await supabase
      .from("categorized_transactions")
      .insert(transactionsToInsert);

    if (insertError) {
      console.error("Insert error:", insertError);
      return {
        success: false,
        error: "Failed to save transactions",
      };
    }

    return {
      success: true,
      transactionCount: transactions.length,
    };
  } catch (error: any) {
    console.error("Process spreadsheet error:", error);
    return {
      success: false,
      error: error.message || "Failed to process spreadsheet",
    };
  }
}

