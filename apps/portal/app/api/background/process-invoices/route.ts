import { waitUntil } from "@vercel/functions";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createJobErrorResponse, mapErrorToCode } from "@/lib/errors/job-errors";

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

    // Verify job belongs to user
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

    // Start background processing
    waitUntil(
      processInvoicesBatch(jobId, user.id, supabase)
    );

    return NextResponse.json({
      success: true,
      jobId,
      message: "Processing started in background",
    });
  } catch (error: any) {
    console.error("Background processing error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

async function processInvoicesBatch(
  jobId: string,
  userId: string,
  supabase: any
) {
  const BATCH_SIZE = 10; // Process 10 invoices at a time

  try {
    // Update job status
    await supabase
      .from("categorization_jobs")
      .update({ 
        status: "processing",
        status_message: "Processing invoices...",
        started_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    // Get documents for this job
    const { data: documents } = await supabase
      .from("documents")
      .select("*")
      .eq("job_id", jobId)
      .in("processing_status", ["pending", "failed"]);

    if (!documents || documents.length === 0) {
      const errorResponse = createJobErrorResponse("PROCESSING_FAILED", "No documents found");
      await supabase
        .from("categorization_jobs")
        .update({ 
          status: "failed",
          error_code: errorResponse.error_code,
          error_message: errorResponse.error_message,
          status_message: errorResponse.status_message,
        })
        .eq("id", jobId);
      return;
    }

    let processedCount = 0;
    let failedCount = 0;

    // Process in batches
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      
      // Process batch in parallel
      const results = await Promise.allSettled(
        batch.map((doc: any) => processSingleInvoice(doc, jobId, userId, supabase))
      );

      // Count successes and failures
      for (const result of results) {
        if (result.status === "fulfilled") {
          processedCount++;
        } else {
          failedCount++;
          console.error("Invoice processing failed:", result.reason);
        }
      }

      // Update progress
      const progressMessage = `Processing ${processedCount + failedCount} of ${documents.length} invoices...`;
      await supabase
        .from("categorization_jobs")
        .update({ 
          processed_items: processedCount,
          failed_items: failedCount,
          status_message: progressMessage,
        })
        .eq("id", jobId);

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < documents.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Mark job as complete
    const finalStatus = failedCount === documents.length ? "failed" : "reviewing";
    const finalMessage = failedCount === documents.length 
      ? "Processing failed for all invoices"
      : `Processing complete. ${processedCount} invoice${processedCount !== 1 ? "s" : ""} ready for review.`;
    
    if (finalStatus === "failed") {
      const errorResponse = createJobErrorResponse("PROCESSING_FAILED", "All invoices failed to process");
      await supabase
        .from("categorization_jobs")
        .update({ 
          status: finalStatus,
          error_code: errorResponse.error_code,
          error_message: errorResponse.error_message,
          status_message: finalMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    } else {
      await supabase
        .from("categorization_jobs")
        .update({ 
          status: finalStatus,
          status_message: finalMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    }

    console.log(`Job ${jobId} completed: ${processedCount} processed, ${failedCount} failed`);
  } catch (error: any) {
    console.error(`Error processing batch for job ${jobId}:`, error);
    const errorCode = mapErrorToCode(error);
    const errorResponse = createJobErrorResponse(errorCode, error.message);
    await supabase
      .from("categorization_jobs")
      .update({ 
        status: "failed",
        error_code: errorResponse.error_code,
        error_message: errorResponse.error_message,
        status_message: errorResponse.status_message,
      })
      .eq("id", jobId);
  }
}

async function processSingleInvoice(
  doc: any,
  jobId: string,
  userId: string,
  supabase: any
): Promise<void> {
  // Import OCR processing function
  const { processInvoiceOCR } = await import("@/lib/ocr/google-document-ai");
  
  // Update document status
  await supabase
    .from("documents")
    .update({ processing_status: "processing" })
    .eq("id", doc.id);

  try {
    // Download file
    const filePath = doc.original_filename;
    const fullPath = `${userId}/invoices/${filePath.split("-").slice(1).join("-")}`;
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("categorization-uploads")
      .download(fullPath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${filePath}`);
    }

    // Process OCR
    const invoiceData = await processInvoiceOCR(fileData, doc.original_filename);

    // Update document with extracted data
    await supabase
      .from("documents")
      .update({
        vendor_name: invoiceData.vendor_name || null,
        invoice_date: invoiceData.invoice_date || null,
        invoice_number: invoiceData.invoice_number || null,
        total_amount: invoiceData.total || null,
        currency: invoiceData.currency || "USD",
        extracted_text: invoiceData.extracted_text || null,
        ocr_confidence_score: invoiceData.confidence_score || 0.9,
        processing_status: "completed",
      })
      .eq("id", doc.id);

    // Convert to transactions and categorize
    await convertInvoiceToTransactions(invoiceData, jobId, userId, supabase);
  } catch (error: any) {
    console.error(`Error processing invoice ${doc.id}:`, error);
    await supabase
      .from("documents")
      .update({
        processing_status: "failed",
      })
      .eq("id", doc.id);
    // Re-throw with mapped error code for better error handling
    const errorCode = mapErrorToCode(error);
    const mappedError = new Error(error.message || "Invoice processing failed");
    (mappedError as any).code = errorCode;
    throw mappedError;
  }
}

async function convertInvoiceToTransactions(
  invoiceData: any,
  jobId: string,
  userId: string,
  supabase: any
): Promise<void> {
  // Get bank_account_id from job
  const { data: jobData } = await supabase
    .from("categorization_jobs")
    .select("bank_account_id")
    .eq("id", jobId)
    .single();

  const bankAccountId = jobData?.bank_account_id || null;

  const transactions: any[] = [];

  // Create transactions from invoice data
  if (invoiceData.line_items && invoiceData.line_items.length > 0) {
    for (const item of invoiceData.line_items) {
      transactions.push({
        job_id: jobId,
        original_description: `${invoiceData.vendor_name || "Vendor"} - ${item.description}`,
        amount: item.total,
        date: invoiceData.invoice_date || new Date().toISOString().split("T")[0],
        category: null,
        subcategory: null,
        confidence_score: 0.5,
        bank_account_id: bankAccountId,
        user_confirmed: false,
      });
    }
  } else if (invoiceData.total) {
      transactions.push({
        job_id: jobId,
        original_description: invoiceData.vendor_name || "Invoice",
        amount: invoiceData.total,
        date: invoiceData.invoice_date || new Date().toISOString().split("T")[0],
        category: null,
        subcategory: null,
        confidence_score: 0.5,
        user_confirmed: false,
        bank_account_id: bankAccountId,
      });
  }

  if (transactions.length === 0) {
    return;
  }

  // Insert transactions
  const { data: insertedTransactions, error: insertError } = await supabase
    .from("categorized_transactions")
    .insert(transactions)
    .select();

  if (insertError || !insertedTransactions) {
    throw new Error("Failed to insert transactions");
  }

  // Categorize transactions (basic rule-based)
  await categorizeTransactions(insertedTransactions, userId, supabase);
}

async function categorizeTransactions(
  transactions: any[],
  userId: string,
  supabase: any
): Promise<void> {
  // Get user's category mappings
  const { data: mappings } = await supabase
    .from("user_category_mappings")
    .select("*")
    .eq("user_id", userId);

  for (const tx of transactions) {
    let category: string | undefined;
    let subcategory: string | undefined;
    let confidenceScore = 0.5;

    // Check user mappings
    if (mappings && mappings.length > 0) {
      for (const mapping of mappings) {
        const pattern = mapping.pattern.toLowerCase();
        const description = tx.original_description.toLowerCase();
        
        if (description.includes(pattern)) {
          category = mapping.category;
          subcategory = mapping.subcategory || undefined;
          confidenceScore = 0.9;
          break;
        }
      }
    }

    // Basic keyword matching
    if (!category) {
      const desc = tx.original_description.toLowerCase();
      
      if (desc.includes("office") || desc.includes("supplies")) {
        category = "Office Supplies";
        confidenceScore = 0.7;
      } else if (desc.includes("software") || desc.includes("saas")) {
        category = "Software & Subscriptions";
        confidenceScore = 0.7;
      } else {
        category = "Uncategorized";
        confidenceScore = 0.3;
      }
    }

    // Update transaction
    await supabase
      .from("categorized_transactions")
      .update({
        category,
        subcategory,
        confidence_score: confidenceScore,
      })
      .eq("id", tx.id);
  }
}
