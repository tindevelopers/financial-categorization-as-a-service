import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
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

    // Get tenant_id for the user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userData } = await (supabase as any)
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single() as { data: { tenant_id: string | null } | null; error: unknown };

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload .xlsx, .xls, or .csv" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${user.id}/${Date.now()}-${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from("categorization-uploads")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file: " + uploadError.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("categorization-uploads")
      .getPublicUrl(fileName);

    // Create categorization job
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
      console.error("Job creation error:", jobError);
      return NextResponse.json(
        { error: "Failed to create job: " + (jobError.message || JSON.stringify(jobError)) },
        { status: 500 }
      );
    }

    // Process the file inline
    try {
      // Parse spreadsheet from buffer directly (no need to re-download)
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

      // Extract transactions
      const transactions = extractTransactions(data);

      if (transactions.length === 0) {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("categorization_jobs")
        .update({ total_items: transactions.length })
        .eq("id", jobData.id);

      // Categorize transactions
      const categorizedTransactions = await categorizeTransactions(
        transactions,
        user.id,
        supabase
      );

      // Insert categorized transactions
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
        console.error("Insert error:", insertError);
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

      // Update job status to reviewing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("categorization_jobs")
        .update({ 
          status: "reviewing",
          processed_items: transactions.length,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobData.id);

      return NextResponse.json({
        success: true,
        jobId: jobData.id,
        transactionCount: transactions.length,
        message: "File uploaded and processed successfully",
      });
    } catch (processError) {
      console.error("Processing error:", processError);
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
    console.error("Upload error:", error);
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
  const useAI = process.env.USE_AI_CATEGORIZATION === "true";
  
  if (useAI) {
    try {
      const { AICategorizationFactory } = await import("@/lib/ai/AICategorizationFactory");
      const provider = AICategorizationFactory.getDefaultProvider();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userMappings = mappings?.map((m: any) => ({
        pattern: m.pattern,
        category: m.category,
        subcategory: m.subcategory || undefined,
      }));
      
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
        const batchResults = await aiService.categorizeBatch(batch);
        
        for (let j = 0; j < batch.length; j++) {
          const originalTx = transactions[i + j];
          const aiResult = batchResults[j];
          // Safety check: if AI didn't return a result for this transaction, use fallback
          if (aiResult) {
            results.push({
              ...originalTx,
              category: aiResult.category || "Uncategorized",
              subcategory: aiResult.subcategory,
              confidenceScore: aiResult.confidenceScore || 0.5,
            });
          } else {
            results.push({
              ...originalTx,
              category: "Uncategorized",
              confidenceScore: 0.3,
            });
          }
        }
      }
      
      return results;
    } catch (error) {
      console.error("AI categorization failed, falling back to rule-based:", error);
    }
  }

  // Rule-based categorization fallback
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
