import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import * as XLSX from "xlsx";

interface Transaction {
  date: Date | string;
  description: string;
  amount: number;
}

export async function POST(request: NextRequest) {
  console.log("[UPLOAD] Starting upload request");
  
  try {
    console.log("[UPLOAD] Creating Supabase client");
    const supabase = await createClient();
    
    console.log("[UPLOAD] Getting user");
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log("[UPLOAD] Auth error:", authError?.message || "No user");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    console.log("[UPLOAD] User authenticated:", user.id);

    // Get tenant_id for the user
    console.log("[UPLOAD] Getting user tenant_id");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userData, error: userError } = await (supabase as any)
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single() as { data: { tenant_id: string | null } | null; error: unknown };
    
    if (userError) {
      console.log("[UPLOAD] User lookup warning (continuing anyway):", userError);
    }
    console.log("[UPLOAD] User tenant_id:", userData?.tenant_id || "none");

    console.log("[UPLOAD] Getting form data");
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      console.log("[UPLOAD] No file in form data");
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }
    console.log("[UPLOAD] File received:", file.name, "Size:", file.size, "Type:", file.type);

    // Validate file type
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      console.log("[UPLOAD] Invalid file type:", fileExtension);
      return NextResponse.json(
        { error: "Invalid file type. Please upload .xlsx, .xls, or .csv" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      console.log("[UPLOAD] File too large:", file.size);
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    console.log("[UPLOAD] Reading file buffer");
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${user.id}/${Date.now()}-${file.name}`;
    console.log("[UPLOAD] Uploading to Supabase Storage:", fileName);
    
    const { error: uploadError } = await supabase.storage
      .from("categorization-uploads")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[UPLOAD] Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file: " + uploadError.message },
        { status: 500 }
      );
    }
    console.log("[UPLOAD] File uploaded to storage successfully");

    // Get public URL
    console.log("[UPLOAD] Getting public URL");
    const { data: urlData } = supabase.storage
      .from("categorization-uploads")
      .getPublicUrl(fileName);
    console.log("[UPLOAD] Public URL:", urlData.publicUrl);

    // Create categorization job
    console.log("[UPLOAD] Creating categorization job");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: jobData, error: jobError } = await (supabase as any)
      .from("categorization_jobs")
      .insert({
        user_id: user.id,
        tenant_id: userData?.tenant_id || null,
        job_type: "spreadsheet",
        status: "processing",
        processing_mode: "sync",
        original_filename: file.name,
        file_url: urlData.publicUrl,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) {
      console.error("[UPLOAD] Job creation error:", jobError);
      return NextResponse.json(
        { error: "Failed to create job: " + (jobError.message || JSON.stringify(jobError)) },
        { status: 500 }
      );
    }
    console.log("[UPLOAD] Job created:", jobData.id);

    // Process the file inline
    try {
      // Parse spreadsheet from buffer directly (no need to re-download)
      console.log("[UPLOAD] Parsing spreadsheet");
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      console.log("[UPLOAD] Sheet name:", sheetName);
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });
      console.log("[UPLOAD] Parsed rows:", data.length);

      // Extract transactions
      const transactions = extractTransactions(data);
      console.log("[UPLOAD] Extracted transactions:", transactions.length);

      if (transactions.length === 0) {
        console.log("[UPLOAD] No transactions found in spreadsheet");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("categorization_jobs")
          .update({ 
            status: "failed",
            error_message: "No transactions found in spreadsheet",
          })
          .eq("id", jobData.id);
        
        return NextResponse.json({
          success: false,
          jobId: jobData.id,
          error: "No transactions found in spreadsheet",
        });
      }

      // Update job with total items
      console.log("[UPLOAD] Updating job with total items");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("categorization_jobs")
        .update({ total_items: transactions.length })
        .eq("id", jobData.id);

      // Categorize transactions
      console.log("[UPLOAD] Categorizing transactions");
      const categorizedTransactions = await categorizeTransactions(
        transactions,
        user.id,
        supabase
      );
      console.log("[UPLOAD] Categorization complete");

      // Insert categorized transactions
      console.log("[UPLOAD] Inserting transactions into database");
      const transactionsToInsert = categorizedTransactions.map(tx => ({
        job_id: jobData.id,
        original_description: tx.description,
        amount: tx.amount,
        date: tx.date,
        category: tx.category || null,
        subcategory: tx.subcategory || null,
        confidence_score: tx.confidenceScore || 0.5,
        user_confirmed: false,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase as any)
        .from("categorized_transactions")
        .insert(transactionsToInsert);

      if (insertError) {
        console.error("[UPLOAD] Insert error:", insertError);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("categorization_jobs")
          .update({ 
            status: "failed",
            error_message: "Failed to save transactions: " + (insertError.message || JSON.stringify(insertError)),
          })
          .eq("id", jobData.id);
        
        return NextResponse.json({
          success: false,
          jobId: jobData.id,
          error: "Failed to save transactions: " + (insertError.message || JSON.stringify(insertError)),
        });
      }
      console.log("[UPLOAD] Transactions inserted successfully");

      // Update job status to reviewing
      console.log("[UPLOAD] Updating job status to reviewing");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("categorization_jobs")
        .update({ 
          status: "reviewing",
          processed_items: transactions.length,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobData.id);

      console.log("[UPLOAD] SUCCESS - returning response");
      return NextResponse.json({
        success: true,
        jobId: jobData.id,
        transactionCount: transactions.length,
        message: "File uploaded and processed successfully",
      });
    } catch (processError) {
      console.error("[UPLOAD] Processing error:", processError);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("categorization_jobs")
        .update({ 
          status: "failed",
          error_message: processError instanceof Error ? processError.message : "Processing failed",
        })
        .eq("id", jobData.id);
      
      return NextResponse.json({
        success: false,
        jobId: jobData.id,
        error: "Failed to process file: " + (processError instanceof Error ? processError.message : "Unknown error"),
      });
    }
  } catch (error: unknown) {
    console.error("[UPLOAD] Top-level error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper functions for transaction extraction and categorization
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTransactions(data: any[]): Transaction[] {
  const transactions: Transaction[] = [];

  for (const row of data) {
    // Try to find date, description, and amount columns (case-insensitive)
    const rowLower: Record<string, unknown> = {};
    for (const key of Object.keys(row)) {
      rowLower[key.toLowerCase()] = row[key];
    }

    const dateKeys = ["date", "transaction_date", "posted_date", "date_posted", "trans date"];
    const descKeys = ["description", "memo", "details", "transaction", "merchant", "payee", "name"];
    const amountKeys = ["amount", "debit", "credit", "transaction_amount", "value"];

    let date: Date | string | null = null;
    let description: string | null = null;
    let amount: number | null = null;

    // Find date
    for (const key of dateKeys) {
      const value = rowLower[key] || row[key];
      if (value) {
        date = parseDate(value);
        if (date) break;
      }
    }
    if (!date) {
      const firstKey = Object.keys(row)[0];
      if (firstKey && isDateLike(row[firstKey])) {
        date = parseDate(row[firstKey]);
      }
    }

    // Find description
    for (const key of descKeys) {
      const value = rowLower[key] || row[key];
      if (value && typeof value === "string") {
        description = value.trim();
        break;
      }
    }
    if (!description) {
      const keys = Object.keys(row);
      if (keys.length > 1) {
        description = String(row[keys[1]] || "").trim();
      }
    }

    // Find amount
    for (const key of amountKeys) {
      const value = rowLower[key] || row[key];
      if (value !== undefined && value !== null && value !== "") {
        amount = parseAmount(value);
        if (amount !== null) break;
      }
    }
    if (amount === null) {
      const keys = Object.keys(row);
      if (keys.length > 0) {
        amount = parseAmount(row[keys[keys.length - 1]]);
      }
    }

    if (date && description && amount !== null) {
      transactions.push({ date, description, amount });
    }
  }

  return transactions;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDate(value: any): Date | string | null {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }
  if (typeof value === "number") {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAmount(value: any): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,€£¥]/g, "").replace(/,/g, "").trim();
    const isNegative = cleaned.startsWith("(") && cleaned.endsWith(")");
    const numStr = isNegative ? cleaned.slice(1, -1) : cleaned;
    const parsed = parseFloat(numStr);
    if (!isNaN(parsed)) {
      return isNegative ? -parsed : parsed;
    }
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isDateLike(value: any): boolean {
  if (value instanceof Date) return true;
  if (typeof value === "string") {
    return /^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}/.test(value) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(value);
  }
  return false;
}

// Debug logging helper
const DEBUG_ENDPOINT = 'http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e';
function debugLog(location: string, message: string, data: Record<string, unknown>, hypothesisId: string) {
  // #region agent log
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location, message, data, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId })
  }).catch(() => {});
  // #endregion
}

async function categorizeTransactions(
  transactions: Transaction[],
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<Array<Transaction & { category?: string; subcategory?: string; confidenceScore?: number }>> {
  // Get user's category mappings
  const { data: mappings } = await supabase
    .from("user_category_mappings")
    .select("*")
    .eq("user_id", userId);

  // Use AI categorization if enabled
  const useAIValue = process.env.USE_AI_CATEGORIZATION;
  const useAI = useAIValue === "true";
  
  // #region agent log
  debugLog('upload/route.ts:categorizeTransactions', 'Function entry', {
    USE_AI_CATEGORIZATION_raw: useAIValue,
    USE_AI_CATEGORIZATION_type: typeof useAIValue,
    USE_AI_CATEGORIZATION_exactMatch: useAIValue === "true",
    useAI_boolean: useAI,
    transactionCount: transactions.length,
  }, 'A');
  // #endregion
  
  if (useAI) {
    // #region agent log
    debugLog('upload/route.ts:categorizeTransactions', 'AI branch entered', {}, 'A');
    // #endregion
    
    try {
      const { AICategorizationFactory } = await import("@/lib/ai/AICategorizationFactory");
      const provider = AICategorizationFactory.getDefaultProvider();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userMappings = mappings?.map((m: any) => ({
        pattern: m.pattern,
        category: m.category,
        subcategory: m.subcategory || undefined,
      }));
      
      // #region agent log
      debugLog('upload/route.ts:categorizeTransactions', 'Creating AI service', {
        provider,
        userMappingsCount: userMappings?.length || 0,
      }, 'C');
      // #endregion
      
      const aiService = AICategorizationFactory.create(provider, userMappings);
      
      const aiTransactions = transactions.map(tx => ({
        original_description: tx.description,
        amount: tx.amount,
        date: typeof tx.date === "string" ? tx.date : tx.date.toISOString().split("T")[0],
      }));

      const BATCH_SIZE = 20;
      const results: Array<Transaction & { category?: string; subcategory?: string; confidenceScore?: number }> = [];
      
      for (let i = 0; i < aiTransactions.length; i += BATCH_SIZE) {
        const batch = aiTransactions.slice(i, i + BATCH_SIZE);
        
        // #region agent log
        debugLog('upload/route.ts:categorizeTransactions', 'Processing batch', {
          batchNumber: Math.floor(i/BATCH_SIZE) + 1,
          batchSize: batch.length,
        }, 'D');
        // #endregion
        
        const batchResults = await aiService.categorizeBatch(batch);
        
        // #region agent log
        debugLog('upload/route.ts:categorizeTransactions', 'Batch completed', {
          batchNumber: Math.floor(i/BATCH_SIZE) + 1,
          resultsCount: batchResults.length,
          firstCategory: batchResults[0]?.category || 'none',
        }, 'D');
        // #endregion
        
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
      debugLog('upload/route.ts:categorizeTransactions', 'AI categorization SUCCESS', {
        totalResults: results.length,
        sampleCategory: results[0]?.category || 'none',
        sampleConfidence: results[0]?.confidenceScore || 0,
      }, 'D');
      // #endregion
      
      return results;
    } catch (error) {
      // #region agent log
      debugLog('upload/route.ts:categorizeTransactions', 'AI categorization FAILED', {
        errorType: typeof error,
        errorName: error instanceof Error ? error.name : 'unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
      }, 'D');
      // #endregion
      
      console.error("[AI] AI categorization FAILED:", error);
    }
  } else {
    // #region agent log
    debugLog('upload/route.ts:categorizeTransactions', 'AI disabled - using rules', {
      reason: 'USE_AI_CATEGORIZATION not true',
      actualValue: useAIValue,
    }, 'A');
    // #endregion
  }

  // Rule-based categorization fallback
  console.log("[RULES] Starting rule-based categorization");
  return transactions.map(tx => {
    let category: string | undefined;
    let subcategory: string | undefined;
    let confidenceScore = 0.5;

    // Check user mappings first
    if (mappings && mappings.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const mapping of mappings as any[]) {
        const pattern = mapping.pattern.toLowerCase();
        const description = tx.description.toLowerCase();
        if (description.includes(pattern)) {
          category = mapping.category;
          subcategory = mapping.subcategory || undefined;
          confidenceScore = 0.9;
          break;
        }
      }
    }

    // Basic keyword matching if no mapping found
    if (!category) {
      const desc = tx.description.toLowerCase();
      
      if (desc.includes("grocery") || desc.includes("supermarket") || desc.includes("whole foods") || desc.includes("trader joe")) {
        category = "Food & Dining"; subcategory = "Groceries"; confidenceScore = 0.7;
      } else if (desc.includes("restaurant") || desc.includes("cafe") || desc.includes("pizza") || desc.includes("burger")) {
        category = "Food & Dining"; subcategory = "Restaurants"; confidenceScore = 0.7;
      } else if (desc.includes("gas") || desc.includes("fuel") || desc.includes("shell") || desc.includes("chevron") || desc.includes("exxon")) {
        category = "Transportation"; subcategory = "Gas & Fuel"; confidenceScore = 0.7;
      } else if (desc.includes("uber") || desc.includes("lyft") || desc.includes("taxi") || desc.includes("parking")) {
        category = "Transportation"; subcategory = "Other"; confidenceScore = 0.6;
      } else if (desc.includes("amazon") || desc.includes("walmart") || desc.includes("target") || desc.includes("costco")) {
        category = "Shopping"; subcategory = "General"; confidenceScore = 0.7;
      } else if (desc.includes("electric") || desc.includes("water") || desc.includes("internet") || desc.includes("comcast") || desc.includes("verizon")) {
        category = "Utilities"; subcategory = "General"; confidenceScore = 0.7;
      } else if (desc.includes("netflix") || desc.includes("spotify") || desc.includes("hulu") || desc.includes("disney")) {
        category = "Entertainment"; subcategory = "Streaming"; confidenceScore = 0.8;
      } else if (desc.includes("insurance") || desc.includes("geico") || desc.includes("allstate")) {
        category = "Insurance"; subcategory = "General"; confidenceScore = 0.7;
      } else {
        category = "Uncategorized"; confidenceScore = 0.3;
      }
    }

    return { ...tx, category, subcategory, confidenceScore };
  });
}
