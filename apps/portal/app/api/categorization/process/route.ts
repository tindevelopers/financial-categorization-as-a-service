import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import * as XLSX from "xlsx";

interface Transaction {
  date: Date | string;
  description: string;
  amount: number;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from("categorization_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Update job status to processing
    await supabase
      .from("categorization_jobs")
      .update({ 
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    // Download file from Supabase Storage
    const fileName = job.file_url?.split("/").pop() || "";
    const filePath = `${user.id}/${fileName.split("-").slice(1).join("-")}`;
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("categorization-uploads")
      .download(filePath);

    if (downloadError || !fileData) {
      await supabase
        .from("categorization_jobs")
        .update({ 
          status: "failed",
          error_message: "Failed to download file",
        })
        .eq("id", jobId);
      
      return NextResponse.json(
        { error: "Failed to download file" },
        { status: 500 }
      );
    }

    // Parse spreadsheet
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    // Extract transactions (try to detect columns)
    const transactions = extractTransactions(data);

    if (transactions.length === 0) {
      await supabase
        .from("categorization_jobs")
        .update({ 
          status: "failed",
          error_message: "No transactions found in spreadsheet",
        })
        .eq("id", jobId);
      
      return NextResponse.json(
        { error: "No transactions found in spreadsheet" },
        { status: 400 }
      );
    }

    // Update job with total items
    await supabase
      .from("categorization_jobs")
      .update({ total_items: transactions.length })
      .eq("id", jobId);

    // Categorize transactions
    const categorizedTransactions = await categorizeTransactions(
      transactions,
      user.id,
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
      await supabase
        .from("categorization_jobs")
        .update({ 
          status: "failed",
          error_message: "Failed to save transactions",
        })
        .eq("id", jobId);
      
      return NextResponse.json(
        { error: "Failed to save transactions" },
        { status: 500 }
      );
    }

    // Update job status to reviewing
    await supabase
      .from("categorization_jobs")
      .update({ 
        status: "reviewing",
        processed_items: transactions.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return NextResponse.json({
      success: true,
      jobId,
      transactionCount: transactions.length,
      message: "Spreadsheet processed successfully",
    });
  } catch (error: any) {
    console.error("Process error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

function extractTransactions(data: any[]): Transaction[] {
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

async function categorizeTransactions(
  transactions: Transaction[],
  userId: string,
  supabase: any
): Promise<Array<Transaction & { category?: string; subcategory?: string; confidenceScore?: number }>> {
  // Get user's category mappings
  const { data: mappings } = await supabase
    .from("user_category_mappings")
    .select("*")
    .eq("user_id", userId);

  // Use AI categorization service if available
  const useAI = process.env.USE_AI_CATEGORIZATION === "true";
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process/route.ts:categorizeTransactions',message:'AI config check',data:{useAI,USE_AI_CATEGORIZATION:process.env.USE_AI_CATEGORIZATION,OPENAI_API_KEY_EXISTS:!!process.env.OPENAI_API_KEY,AI_CATEGORIZATION_PROVIDER:process.env.AI_CATEGORIZATION_PROVIDER,transactionCount:transactions.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1,H2'})}).catch(()=>{});
  // #endregion
  
  if (useAI) {
    try {
      const { AICategorizationFactory } = await import("@/lib/ai/AICategorizationFactory");
      const provider = AICategorizationFactory.getDefaultProvider();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process/route.ts:categorizeTransactions',message:'AI factory loaded',data:{provider},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
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
      const results: Array<Transaction & { category?: string; subcategory?: string; confidenceScore?: number }> = [];
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process/route.ts:categorizeTransactions',message:'Starting AI batch processing',data:{totalTransactions:aiTransactions.length,batchSize:BATCH_SIZE},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3,H5'})}).catch(()=>{});
      // #endregion
      
      for (let i = 0; i < aiTransactions.length; i += BATCH_SIZE) {
        const batch = aiTransactions.slice(i, i + BATCH_SIZE);
        const batchResults = await aiService.categorizeBatch(batch);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process/route.ts:categorizeTransactions',message:'Batch completed',data:{batchIndex:i,batchResultCount:batchResults.length,sampleResult:batchResults[0]},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H5'})}).catch(()=>{});
        // #endregion
        
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
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process/route.ts:categorizeTransactions',message:'AI categorization complete',data:{totalResults:results.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      
      return results;
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process/route.ts:categorizeTransactions',message:'AI categorization FAILED',data:{errorMessage:error?.message,errorName:error?.name,errorStack:error?.stack?.slice(0,500)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3,H4,H5'})}).catch(()=>{});
      // #endregion
      console.error("AI categorization failed, falling back to rule-based:", error);
      // Fall through to rule-based categorization
    }
  } else {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process/route.ts:categorizeTransactions',message:'AI SKIPPED - using rule-based',data:{reason:'USE_AI_CATEGORIZATION is not true'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
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
