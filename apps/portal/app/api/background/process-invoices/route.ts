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

    // Get documents for this job from financial_documents table
    const { data: documents } = await supabase
      .from("financial_documents")
      .select("*")
      .eq("job_id", jobId)
      .in("ocr_status", ["pending", "failed"])
      .in("file_type", ["receipt", "invoice"]);

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
    .from("financial_documents")
    .update({ ocr_status: "processing" })
    .eq("id", doc.id);

  try {
    // Download file - use supabase_path from financial_documents
    const filePath = doc.supabase_path || `${userId}/invoices/${doc.original_filename.split("-").slice(1).join("-")}`;
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("categorization-uploads")
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${filePath}`);
    }

    // Process OCR
    const invoiceData = await processInvoiceOCR(fileData, doc.original_filename);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:214',message:'OCR extraction result',data:{docId:doc.id,jobId,hasTotal:!!invoiceData.total,total:invoiceData.total,hasLineItems:!!invoiceData.line_items,lineItemsCount:invoiceData.line_items?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

    // Verify OCR source before updating
    const { verifyOCRSource } = await import("@/lib/ocr/google-document-ai");
    const ocrVerification = verifyOCRSource();

    // Update document with extracted data in financial_documents table
    await supabase
      .from("financial_documents")
      .update({
        vendor_name: invoiceData.vendor_name || null,
        document_date: invoiceData.invoice_date || null,
        invoice_number: invoiceData.invoice_number || null,
        total_amount: invoiceData.total || null,
        currency: invoiceData.currency || "USD",
        extracted_text: invoiceData.extracted_text || null,
        ocr_confidence_score: invoiceData.confidence_score || 0.5,
        ocr_status: "completed",
        ocr_provider: ocrVerification.provider,
        // Store line items and breakdown
        subtotal_amount: invoiceData.subtotal || null,
        tax_amount: invoiceData.tax || null,
        fee_amount: invoiceData.fee_amount || null,
        line_items: invoiceData.line_items || null, // Store as JSONB array
        extracted_data: {
          line_items: invoiceData.line_items || [],
          subtotal: invoiceData.subtotal,
          tax: invoiceData.tax,
          total: invoiceData.total,
          fee_amount: invoiceData.fee_amount,
          shipping_amount: invoiceData.shipping_amount,
        },
      })
      .eq("id", doc.id);

    // Convert invoice to transactions
    const transactions = await invoiceToTransactions(invoiceData, jobId, supabase);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:250',message:'Transactions created from invoice',data:{docId:doc.id,jobId,transactionsCount:transactions.length,transactionJobIds:transactions.map(t=>t.job_id)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1,H2'})}).catch(()=>{});
    // #endregion

    // Insert transactions
    let insertedTransactionIds: string[] = [];
    if (transactions.length > 0) {
      const { data: insertedTransactions, error: txError } = await supabase
        .from("categorized_transactions")
        .insert(transactions)
        .select("id");

      if (txError) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:260',message:'Transaction insert error',data:{docId:doc.id,jobId,errorCode:txError.code,errorMessage:txError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
        // #endregion
        console.error("Transaction insert error:", txError);
      } else {
        insertedTransactionIds = insertedTransactions?.map((t: any) => t.id) || [];
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:263',message:'Transactions inserted successfully',data:{docId:doc.id,jobId,insertedCount:insertedTransactionIds.length,insertedIds:insertedTransactionIds.slice(0,3)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        // Categorize the transactions
        await categorizeInvoiceTransactions(insertedTransactions || transactions, userId, supabase);
        
        // Attempt automatic reconciliation after transactions are created
        if (insertedTransactionIds.length > 0) {
          await reconcileInvoiceAfterProcessing(doc.id, insertedTransactionIds, userId, jobId, supabase);
        }
      }
    } else {
      // Even if no transactions were created, try to reconcile the invoice document
      await reconcileInvoiceAfterProcessing(doc.id, [], userId, jobId, supabase);
    }
  } catch (error: any) {
    console.error(`Error processing invoice ${doc.id}:`, error);
    await supabase
      .from("financial_documents")
      .update({
        ocr_status: "failed",
        ocr_error: error.message || "Processing failed",
      })
      .eq("id", doc.id);
    // Re-throw with mapped error code for better error handling
    const errorCode = mapErrorToCode(error);
    const mappedError = new Error(error.message || "Invoice processing failed");
    (mappedError as any).code = errorCode;
    throw mappedError;
  }
}

async function invoiceToTransactions(
  invoiceData: any, 
  jobId: string,
  supabase: any
): Promise<any[]> {
  // Get bank_account_id from job
  const { data: jobData } = await supabase
    .from("categorization_jobs")
    .select("bank_account_id")
    .eq("id", jobId)
    .single();

  const bankAccountId = jobData?.bank_account_id || null;
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:305',message:'invoiceToTransactions called',data:{jobId,bankAccountId:bankAccountId?.substring(0,8)+'...',hasTotal:!!invoiceData.total,total:invoiceData.total,hasLineItems:!!invoiceData.line_items,lineItemsCount:invoiceData.line_items?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  const transactions: any[] = [];

  // If we have line items, create a transaction for each
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
          user_confirmed: false,
          bank_account_id: bankAccountId,
        });
    }
  } else if (invoiceData.total) {
    // Single transaction for entire invoice
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

  return transactions;
}

async function categorizeInvoiceTransactions(
  transactions: any[],
  userId: string,
  supabase: any
): Promise<void> {
  // Get user's category mappings
  const { data: mappings } = await supabase
    .from("user_category_mappings")
    .select("*")
    .eq("user_id", userId);

  // Categorize each transaction
  for (const tx of transactions) {
    let category: string | undefined;
    let subcategory: string | undefined;
    let confidenceScore = 0.5;

    // Check user mappings first
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

    // If no mapping found, use basic keyword matching
    if (!category) {
      const desc = tx.original_description.toLowerCase();
      
      if (desc.includes("office") || desc.includes("supplies")) {
        category = "Office Supplies";
        confidenceScore = 0.7;
      } else if (desc.includes("software") || desc.includes("saas") || desc.includes("subscription")) {
        category = "Software & Subscriptions";
        confidenceScore = 0.7;
      } else {
        category = "Uncategorized";
        confidenceScore = 0.3;
      }
    }

    // Update transaction with category
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

/**
 * Automatically attempt to reconcile invoice with existing transactions and documents
 * after invoice processing is complete
 */
async function reconcileInvoiceAfterProcessing(
  invoiceDocumentId: string,
  invoiceTransactionIds: string[],
  userId: string,
  jobId: string,
  supabase: any
): Promise<void> {
  try {
    // Get the invoice document details
    const { data: invoiceDoc, error: docError } = await supabase
      .from("financial_documents")
      .select("*")
      .eq("id", invoiceDocumentId)
      .eq("user_id", userId)
      .single();

    if (docError || !invoiceDoc || invoiceDoc.reconciliation_status === "matched") {
      return; // Already matched or not found
    }

    const invoiceAmount = invoiceDoc.total_amount || 0;
    const invoiceDate = invoiceDoc.document_date;

    if (!invoiceAmount || !invoiceDate) {
      return; // Need amount and date for matching
    }

    let matchedCount = 0;

    // Try to match invoice document with existing bank transactions
    // Search across ALL account types (remove account filter)
    const { data: transactions, error: txError } = await supabase
      .from("categorized_transactions")
      .select(`
        *,
        job:categorization_jobs!inner(
          id,
          user_id
        )
      `)
      .eq("job.user_id", userId)
      .eq("reconciliation_status", "unreconciled")
      .is("matched_document_id", null)
      .neq("id", invoiceTransactionIds[0] || "") // Exclude transactions we just created
      .order("date", { ascending: false });

    if (!txError && transactions) {
      for (const tx of transactions) {
        if (tx.matched_document_id) continue;

        const amountDiff = Math.abs((tx.amount || 0) - invoiceAmount);
        const dateDiff = invoiceDate
          ? Math.abs(
              (new Date(tx.date).getTime() - new Date(invoiceDate).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 999;

        // High confidence match: exact amount within 7 days
        if (amountDiff < 0.01 && dateDiff <= 7) {
          const descriptionScore = calculateDescriptionMatch(
            tx.original_description,
            invoiceDoc.vendor_name || invoiceDoc.original_filename
          );

          const totalScore =
            (100 - amountDiff) * 0.5 + (100 - dateDiff) * 0.3 + descriptionScore * 0.2;

          if (totalScore >= 80) {
            // Attempt to match - only match to ONE transaction
            const { error: matchError } = await supabase.rpc("match_transaction_with_document", {
              p_transaction_id: tx.id,
              p_document_id: invoiceDocumentId,
            });

            if (!matchError) {
              matchedCount++;
              // Create G/L breakdown entries for the matched receipt
              await createGLBreakdownFromReceipt(invoiceDoc, tx.id, jobId, supabase);
              break; // Match found, stop searching (one-to-one matching)
            }
          }
        }
      }
    }

    // If no match found, leave as unreconciled (don't create dummy transaction)
    if (matchedCount > 0) {
      console.log(
        `[Reconciliation] Auto-matched invoice ${invoiceDocumentId} with ${matchedCount} transaction(s)`
      );
    } else {
      console.log(
        `[Reconciliation] No match found for invoice ${invoiceDocumentId}, keeping as unreconciled`
      );
    }
  } catch (error: any) {
    console.error("[Reconciliation] Error during auto-reconciliation:", error);
    // Don't throw - reconciliation failure shouldn't fail invoice processing
  }
}

// Helper function to calculate description similarity
function calculateDescriptionMatch(description: string, vendor: string): number {
  if (!description || !vendor) return 0;

  const desc = description.toLowerCase();
  const vend = vendor.toLowerCase();

  // Check if vendor name appears in description
  if (desc.includes(vend) || vend.includes(desc)) {
    return 100;
  }

  // Check for word overlap
  const descWords = desc.split(/\s+/).filter((w) => w.length > 3);
  const vendWords = vend.split(/\s+/).filter((w) => w.length > 3);

  let matchCount = 0;
  for (const dw of descWords) {
    for (const vw of vendWords) {
      if (dw.includes(vw) || vw.includes(dw)) {
        matchCount++;
      }
    }
  }

  const maxWords = Math.max(descWords.length, vendWords.length);
  if (maxWords === 0) return 0;

  return (matchCount / maxWords) * 100;
}

/**
 * Create G/L breakdown entries from receipt when matched to a transaction
 * Creates separate transaction entries for subtotal, tax, fees, shipping
 */
async function createGLBreakdownFromReceipt(
  receiptDoc: any,
  matchedTransactionId: string,
  jobId: string,
  supabase: any
): Promise<void> {
  try {
    // Get the matched transaction to inherit bank_account_id and other fields
    const { data: parentTx, error: txError } = await supabase
      .from("categorized_transactions")
      .select("*")
      .eq("id", matchedTransactionId)
      .single();

    if (txError || !parentTx) {
      console.error("[G/L Breakdown] Failed to fetch parent transaction:", txError);
      return;
    }

    const breakdownEntries: any[] = [];
    const receiptDate = receiptDoc.document_date || parentTx.date;

    // Create breakdown entry for subtotal (main expense)
    if (receiptDoc.subtotal_amount && receiptDoc.subtotal_amount > 0) {
      breakdownEntries.push({
        job_id: jobId,
        parent_transaction_id: matchedTransactionId,
        is_breakdown_entry: true,
        breakdown_type: "subtotal",
        original_description: `${receiptDoc.vendor_name || "Vendor"} - Subtotal`,
        amount: receiptDoc.subtotal_amount,
        date: receiptDate,
        category: parentTx.category || null,
        subcategory: parentTx.subcategory || null,
        confidence_score: 0.8,
        user_confirmed: false,
        bank_account_id: parentTx.bank_account_id,
        reconciliation_status: "matched", // Inherit matched status
        matched_document_id: receiptDoc.id,
      });
    }

    // Create breakdown entry for tax
    if (receiptDoc.tax_amount && receiptDoc.tax_amount > 0) {
      breakdownEntries.push({
        job_id: jobId,
        parent_transaction_id: matchedTransactionId,
        is_breakdown_entry: true,
        breakdown_type: "tax",
        original_description: `${receiptDoc.vendor_name || "Vendor"} - Tax`,
        amount: receiptDoc.tax_amount,
        date: receiptDate,
        category: "Tax Expense", // Default tax category
        subcategory: null,
        confidence_score: 0.9,
        user_confirmed: false,
        bank_account_id: parentTx.bank_account_id,
        reconciliation_status: "matched",
        matched_document_id: receiptDoc.id,
      });
    }

    // Create breakdown entry for fees
    if (receiptDoc.fee_amount && receiptDoc.fee_amount > 0) {
      breakdownEntries.push({
        job_id: jobId,
        parent_transaction_id: matchedTransactionId,
        is_breakdown_entry: true,
        breakdown_type: "fee",
        original_description: `${receiptDoc.vendor_name || "Vendor"} - Fees`,
        amount: receiptDoc.fee_amount,
        date: receiptDate,
        category: "Fees & Charges", // Default fee category
        subcategory: null,
        confidence_score: 0.8,
        user_confirmed: false,
        bank_account_id: parentTx.bank_account_id,
        reconciliation_status: "matched",
        matched_document_id: receiptDoc.id,
      });
    }

    // Extract shipping from extracted_data if available
    const extractedData = receiptDoc.extracted_data || {};
    const shippingAmount = extractedData.shipping_amount || null;
    if (shippingAmount && shippingAmount > 0) {
      breakdownEntries.push({
        job_id: jobId,
        parent_transaction_id: matchedTransactionId,
        is_breakdown_entry: true,
        breakdown_type: "shipping",
        original_description: `${receiptDoc.vendor_name || "Vendor"} - Shipping`,
        amount: shippingAmount,
        date: receiptDate,
        category: "Shipping & Delivery", // Default shipping category
        subcategory: null,
        confidence_score: 0.8,
        user_confirmed: false,
        bank_account_id: parentTx.bank_account_id,
        reconciliation_status: "matched",
        matched_document_id: receiptDoc.id,
      });
    }

    // Insert breakdown entries if any
    if (breakdownEntries.length > 0) {
      const { error: insertError } = await supabase
        .from("categorized_transactions")
        .insert(breakdownEntries);

      if (insertError) {
        console.error("[G/L Breakdown] Failed to insert breakdown entries:", insertError);
      } else {
        console.log(
          `[G/L Breakdown] Created ${breakdownEntries.length} breakdown entries for transaction ${matchedTransactionId}`
        );
      }
    }
  } catch (error: any) {
    console.error("[G/L Breakdown] Error creating breakdown entries:", error);
    // Don't throw - breakdown failure shouldn't fail matching
  }
}

