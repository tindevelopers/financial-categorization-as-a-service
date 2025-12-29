import { waitUntil } from "@vercel/functions";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";
import { createJobErrorResponse, mapErrorToCode } from "@/lib/errors/job-errors";

export async function POST(request: NextRequest) {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:6',message:'Background processing route called',data:{hasBody:!!request.body},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:12',message:'Background processing auth failed',data:{authError:authError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { jobId } = await request.json();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:18',message:'Background processing received jobId',data:{jobId,userId:user.id.substring(0,8)+'...'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:43',message:'Calling waitUntil for background processing',data:{jobId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    waitUntil(
      processInvoicesBatch(jobId, user.id, supabase).catch((err) => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:45',message:'Background batch processing error',data:{jobId,errorMessage:err?.message,errorStack:err?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
        console.error("Background batch processing failed:", err);
      })
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
  const adminClient = createAdminClient();
  const BATCH_SIZE = 10; // Process 10 invoices at a time
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:61',message:'processInvoicesBatch started',data:{jobId,userId:userId.substring(0,8)+'...'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
  // #endregion

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:79',message:'Querying documents for job',data:{jobId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    const { data: documents, error: docsError } = await supabase
      .from("financial_documents")
      .select("*")
      .eq("job_id", jobId)
      .in("ocr_status", ["pending", "failed"])
      .in("file_type", ["receipt", "invoice"]);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:85',message:'Documents query result',data:{jobId,documentsCount:documents?.length||0,hasError:!!docsError,errorMessage:docsError?.message,docIds:documents?.map((d: {id: string}) => d.id).slice(0,3)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2,H4'})}).catch(()=>{});
    // #endregion

    if (!documents || documents.length === 0) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:87',message:'No documents found for job',data:{jobId,queryError:docsError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2,H4'})}).catch(()=>{});
      // #endregion
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
        batch.map((doc: any) => processSingleInvoice(doc, jobId, userId, supabase, adminClient))
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

    // Check if any documents need manual review (OCR failed or no data extracted)
    const { data: docsNeedingReview } = await supabase
      .from("financial_documents")
      .select("id")
      .eq("job_id", jobId)
      .eq("ocr_status", "needs_manual_review");
    
    const needsManualReviewCount = docsNeedingReview?.length || 0;

    // Mark job as complete
    const finalStatus = failedCount === documents.length ? "failed" : "reviewing";
    let finalMessage = failedCount === documents.length 
      ? "Processing failed for all invoices"
      : `Processing complete. ${processedCount} invoice${processedCount !== 1 ? "s" : ""} ready for review.`;
    
    // Add note about manual review needed
    if (needsManualReviewCount > 0 && finalStatus !== "failed") {
      finalMessage += ` (${needsManualReviewCount} need${needsManualReviewCount === 1 ? "s" : ""} manual entry)`;
    }
    
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

    console.log(`Job ${jobId} completed: ${processedCount} processed, ${failedCount} failed, ${needsManualReviewCount} need manual review`);
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
  supabase: any,
  adminClient: any
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
    
    // Log extraction metrics
    if (invoiceData.extraction_metrics) {
      console.log("[OCR Metrics]", {
        docId: doc.id,
        filename: doc.original_filename,
        fieldsExtracted: invoiceData.extraction_metrics.fields_extracted,
        fieldsMissing: invoiceData.extraction_metrics.fields_missing,
        averageConfidence: invoiceData.extraction_metrics.average_confidence,
        methodDistribution: invoiceData.extraction_metrics.method_distribution,
        needsReview: invoiceData.needs_review,
      });
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:214',message:'OCR extraction result',data:{docId:doc.id,jobId,hasTotal:!!invoiceData.total,total:invoiceData.total,hasLineItems:!!invoiceData.line_items,lineItemsCount:invoiceData.line_items?.length||0,confidence:invoiceData.confidence_score,needsReview:invoiceData.needs_review,extractionMethods:invoiceData.extraction_methods},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

    // Verify OCR source before updating
    const { verifyOCRSource } = await import("@/lib/ocr/google-document-ai");
    const ocrVerification = verifyOCRSource();

    // Determine OCR status based on result
    // If OCR failed or returned no usable data, mark as needs_manual_review
    const hasUsableData = !!(invoiceData.total || (invoiceData.line_items && invoiceData.line_items.length > 0));
    const ocrStatus = invoiceData.ocr_failed 
      ? "needs_manual_review" 
      : (hasUsableData ? "completed" : "needs_manual_review");

    // Extract and store supplier information
    let supplierId: string | null = null;
    if (invoiceData.supplier?.name || invoiceData.vendor_name) {
      const supplierName = invoiceData.supplier?.name || invoiceData.vendor_name;
      if (supplierName) {
        // Get tenant_id from document
        const { data: docData } = await supabase
          .from("financial_documents")
          .select("tenant_id")
          .eq("id", doc.id)
          .single();
        
        const tenantId = docData?.tenant_id || null;
        
        // Get or create supplier
        const { data: supplierResult, error: supplierError } = await supabase
          .rpc("get_or_create_supplier", {
            p_user_id: userId,
            p_tenant_id: tenantId,
            p_name: supplierName,
            p_email: invoiceData.supplier?.email || null,
            p_phone: invoiceData.supplier?.phone || null,
            p_website: invoiceData.supplier?.website || null,
            p_address_street: invoiceData.supplier?.address?.street || null,
            p_address_city: invoiceData.supplier?.address?.city || null,
            p_address_postcode: invoiceData.supplier?.address?.postcode || null,
            p_address_country: invoiceData.supplier?.address?.country || null,
          });
        
        if (!supplierError && supplierResult) {
          supplierId = supplierResult;
        } else if (supplierError) {
          console.error("Error creating supplier:", supplierError);
        }
      }
    }

    // Update document with extracted data in financial_documents table
    await supabase
      .from("financial_documents")
      .update({
        vendor_name: invoiceData.vendor_name || null,
        document_date: invoiceData.invoice_date || null,
        document_number: invoiceData.invoice_number || null,
        order_number: invoiceData.order_number || null,
        delivery_date: invoiceData.delivery_date ? new Date(invoiceData.delivery_date).toISOString().split('T')[0] : null,
        supplier_id: supplierId,
        total_amount: invoiceData.total || null,
        currency: invoiceData.currency || "USD",
        extracted_text: invoiceData.extracted_text || null,
        ocr_confidence: invoiceData.confidence_score || 0.5,
        ocr_status: ocrStatus,
        ocr_provider: ocrVerification.provider,
        ocr_error: invoiceData.ocr_error || null,
        // Store line items and breakdown in dedicated columns
        subtotal_amount: invoiceData.subtotal !== undefined ? clampAmount(invoiceData.subtotal) : null,
        tax_amount: invoiceData.tax !== undefined ? clampAmount(invoiceData.tax) : null,
        fee_amount: invoiceData.fee_amount !== undefined ? clampAmount(invoiceData.fee_amount) : null,
        line_items: invoiceData.line_items || null,
        // OCR metrics (stored in dedicated columns for querying)
        ocr_field_confidence: invoiceData.field_confidence || {},
        ocr_extraction_methods: invoiceData.extraction_methods || {},
        ocr_validation_flags: invoiceData.validation_flags || {},
        ocr_metrics: invoiceData.extraction_metrics || null,
        ocr_needs_review: invoiceData.needs_review || false,
        // Also store in extracted_data JSONB for flexibility
        extracted_data: {
          line_items: invoiceData.line_items || [],
          subtotal: invoiceData.subtotal,
          tax: invoiceData.tax,
          total: invoiceData.total,
          fee_amount: invoiceData.fee_amount,
          shipping_amount: invoiceData.shipping_amount,
          ocr_failed: invoiceData.ocr_failed,
          ocr_configured: invoiceData.ocr_configured,
          supplier: invoiceData.supplier,
          order_number: invoiceData.order_number,
          delivery_date: invoiceData.delivery_date,
          // OCR metrics and confidence
          field_confidence: invoiceData.field_confidence || {},
          extraction_methods: invoiceData.extraction_methods || {},
          validation_flags: invoiceData.validation_flags || {},
          extraction_metrics: invoiceData.extraction_metrics || null,
          needs_review: invoiceData.needs_review || false,
        },
      })
      .eq("id", doc.id);

    // Convert invoice to transactions (pass filename, document_id, and supplier_id for linking)
    const transactions = await invoiceToTransactions(
      invoiceData, 
      jobId, 
      supabase, 
      doc.original_filename,
      doc.id, // document_id
      supplierId // supplier_id
    );
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:250',message:'Transactions created from invoice',data:{docId:doc.id,jobId,transactionsCount:transactions.length,transactionJobIds:transactions.map(t=>t.job_id)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1,H2'})}).catch(()=>{});
    // #endregion

    // Insert transactions
    let insertedTransactionIds: string[] = [];
    if (transactions.length > 0) {
      const { data: insertedTransactions, error: txError } = await adminClient
        .from("categorized_transactions")
        .insert(transactions)
        .select("id");

      if (txError) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:260',message:'Transaction insert error',data:{docId:doc.id,jobId,errorCode:txError.code,errorMessage:txError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
        // #endregion
        console.error("Transaction insert error:", txError);
        throw txError;
      } else {
        insertedTransactionIds = insertedTransactions?.map((t: any) => t.id) || [];
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:263',message:'Transactions inserted successfully',data:{docId:doc.id,jobId,insertedCount:insertedTransactionIds.length,insertedIds:insertedTransactionIds.slice(0,3)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
        // #endregion

        // #region agent log
        // Verify document_id persisted on inserted rows (common root cause of UI showing 0/unknown)
        if (insertedTransactionIds.length > 0) {
          const { data: insertedCheck } = await adminClient
            .from("categorized_transactions")
            .select("id, document_id, supplier_id, invoice_number, amount, date")
            .in("id", insertedTransactionIds.slice(0, 5));
          fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:insertCheck',message:'Post-insert check of document_id on categorized_transactions',data:{docId:doc.id,jobId,sample:insertedCheck?.map((r:any)=>({id:r.id,document_id:r.document_id,supplier_id:r.supplier_id,invoice_number:r.invoice_number,amount:r.amount}))||[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
        }
        // #endregion

        // Categorize the transactions
        await categorizeInvoiceTransactions(insertedTransactions || transactions, userId, adminClient);
        
        // Attempt automatic reconciliation after transactions are created
        if (insertedTransactionIds.length > 0) {
          await reconcileInvoiceAfterProcessing(doc.id, insertedTransactionIds, userId, jobId, adminClient);
        }
      }
    } else {
      // Even if no transactions were created, try to reconcile the invoice document
      await reconcileInvoiceAfterProcessing(doc.id, [], userId, jobId, adminClient);
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

// Maximum amount that can be stored in DECIMAL(10,2) - 99,999,999.99
const MAX_AMOUNT = 99999999.99;
const MIN_AMOUNT = -99999999.99;

function clampAmount(amount: number): number {
  return Math.min(Math.max(amount, MIN_AMOUNT), MAX_AMOUNT);
}

function validateAndClampAmount(amount: number | undefined | null, fieldName: string = 'amount'): number | null {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return null;
  }
  
  // Check if amount exceeds database limit
  if (amount > MAX_AMOUNT) {
    console.warn(`[Amount Validation] ${fieldName} ${amount} exceeds maximum ${MAX_AMOUNT}, clamping to maximum`);
    return MAX_AMOUNT;
  }
  
  if (amount < MIN_AMOUNT) {
    console.warn(`[Amount Validation] ${fieldName} ${amount} exceeds minimum ${MIN_AMOUNT}, clamping to minimum`);
    return MIN_AMOUNT;
  }
  
  // Round to 2 decimal places to match database precision
  return Math.round(amount * 100) / 100;
}

async function invoiceToTransactions(
  invoiceData: any, 
  jobId: string,
  supabase: any,
  documentFilename?: string,
  documentId?: string,
  supplierId?: string | null
): Promise<any[]> {
  // Get bank_account_id from job
  const { data: jobData } = await supabase
    .from("categorization_jobs")
    .select("bank_account_id")
    .eq("id", jobId)
    .single();

  const bankAccountId = jobData?.bank_account_id || null;
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'process-invoices/route.ts:305',message:'invoiceToTransactions called',data:{jobId,bankAccountId:bankAccountId?.substring(0,8)+'...',hasTotal:!!invoiceData.total,total:invoiceData.total,hasLineItems:!!invoiceData.line_items,lineItemsCount:invoiceData.line_items?.length||0,ocrFailed:invoiceData.ocr_failed,ocrConfigured:invoiceData.ocr_configured},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  const transactions: any[] = [];

  // Build description components
  const vendorName = invoiceData.vendor_name || invoiceData.supplier?.name || "Vendor";
  const invoiceNumber = invoiceData.invoice_number || invoiceData.order_number;
  const invoiceRef = invoiceNumber ? `Invoice #${invoiceNumber}` : null;
  
  // If we have line items, create a transaction for each
  if (invoiceData.line_items && invoiceData.line_items.length > 0) {
    for (const item of invoiceData.line_items) {
      const validatedAmount = validateAndClampAmount(item.total, 'line_item.total');
      if (validatedAmount === null) {
        console.warn(`[invoiceToTransactions] Skipping line item with invalid amount: ${item.total}`);
        continue;
      }
      
      // Build rich description: Vendor - Line Item Description - Invoice #Number
      const descriptionParts = [vendorName];
      
      // Add line item description (truncate if too long)
      const itemDesc = (item.description || "").trim();
      if (itemDesc) {
        // Truncate very long descriptions to keep it readable
        const maxDescLength = 100;
        const truncatedDesc = itemDesc.length > maxDescLength 
          ? itemDesc.substring(0, maxDescLength) + "..."
          : itemDesc;
        descriptionParts.push(truncatedDesc);
      }
      
      // Add invoice number if available
      if (invoiceRef) {
        descriptionParts.push(invoiceRef);
      }
      
      const fullDescription = descriptionParts.join(" - ");
      
      transactions.push({
        job_id: jobId,
        original_description: fullDescription,
        amount: validatedAmount,
        date: invoiceData.invoice_date || new Date().toISOString().split("T")[0],
        category: null,
        subcategory: null,
        confidence_score: 0.5,
        user_confirmed: false,
        bank_account_id: bankAccountId,
        invoice_number: invoiceNumber || null,
        supplier_id: supplierId || null,
        document_id: documentId || null,
      });
    }
  } else if (invoiceData.total) {
    // Single transaction for entire invoice
    const validatedAmount = validateAndClampAmount(invoiceData.total, 'invoice.total');
    if (validatedAmount !== null) {
      // Build description: Vendor - Invoice #Number (or just Vendor if no invoice number)
      const descriptionParts = [vendorName];
      if (invoiceRef) {
        descriptionParts.push(invoiceRef);
      }
      const fullDescription = descriptionParts.join(" - ");
      
      transactions.push({
        job_id: jobId,
        original_description: fullDescription,
        amount: validatedAmount,
        date: invoiceData.invoice_date || new Date().toISOString().split("T")[0],
        category: null,
        subcategory: null,
        confidence_score: 0.5,
        user_confirmed: false,
        bank_account_id: bankAccountId,
        invoice_number: invoiceNumber || null,
        supplier_id: supplierId || null,
        document_id: documentId || null,
      });
    } else {
      console.warn(`[invoiceToTransactions] Skipping invoice with invalid total amount: ${invoiceData.total}`);
    }
  }

  // FALLBACK: If no transactions were created (OCR failed or returned no data),
  // create a placeholder transaction for manual review
  if (transactions.length === 0) {
    const displayName = documentFilename 
      ? documentFilename.replace(/^\d+-/, '').replace(/\.[^/.]+$/, '') // Remove timestamp prefix and extension
      : "Uploaded receipt";
    
    const ocrStatus = invoiceData.ocr_failed 
      ? (invoiceData.ocr_configured ? "OCR processing failed" : "OCR not configured")
      : "No data extracted";

    console.log(`[invoiceToTransactions] Creating placeholder transaction: ${ocrStatus}`);
    
    transactions.push({
      job_id: jobId,
      original_description: `${displayName} - needs manual review (${ocrStatus})`,
      amount: 0, // User must enter manually
      date: new Date().toISOString().split("T")[0],
      category: "Uncategorized",
      subcategory: null,
      invoice_number: invoiceData.invoice_number || null,
      supplier_id: supplierId || null,
      document_id: documentId || null,
      confidence_score: 0,
      user_confirmed: false,
      bank_account_id: bankAccountId,
    });
  }

  return transactions;
}

async function categorizeInvoiceTransactions(
  transactions: any[],
  userId: string,
  adminClient: any
): Promise<void> {
  if (!transactions || transactions.length === 0) {
    return;
  }

  // Get user's category mappings
  const { data: mappings } = await adminClient
    .from("user_category_mappings")
    .select("*")
    .eq("user_id", userId);

  // Use AI categorization service if available
  const useAI = process.env.USE_AI_CATEGORIZATION === "true";
  
  if (useAI) {
    try {
      const { AICategorizationFactory } = await import("@/lib/ai/AICategorizationFactory");
      const { VercelAICategorizationService } = await import("@/lib/ai/VercelAICategorizationService");
      const provider = AICategorizationFactory.getDefaultProvider();
      
      // Get company profile ID if available
      const { data: companyProfile } = await adminClient
        .from("company_profiles")
        .select("id")
        .eq("user_id", userId)
        .eq("setup_completed", true)
        .limit(1)
        .single();
      
      const companyProfileId = companyProfile?.id;
      
      // Load AI instructions
      const aiInstructions = await VercelAICategorizationService.loadCategorizationInstructions(
        adminClient,
        userId,
        companyProfileId
      );
      
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
      
      // Convert transactions to AI service format
      const aiTransactions = transactions
        .filter(tx => tx.original_description) // Skip transactions without descriptions
        .map(tx => ({
          original_description: tx.original_description || tx.description || "Invoice transaction",
          amount: tx.amount || 0,
          date: typeof tx.date === "string" ? tx.date : (tx.date?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0]),
        }));

      if (aiTransactions.length === 0) {
        return;
      }

      // Categorize in batches (process 20 at a time to avoid token limits)
      const BATCH_SIZE = 20;
      const validTransactions = transactions.filter(tx => tx.original_description);
      
      for (let i = 0; i < aiTransactions.length; i += BATCH_SIZE) {
        const batch = aiTransactions.slice(i, i + BATCH_SIZE);
        const batchTransactions = validTransactions.slice(i, i + BATCH_SIZE);
        
        try {
          const results = await aiService.categorizeBatch(batch);
          
          // Update each transaction with AI categorization results
          for (let j = 0; j < results.length && j < batchTransactions.length; j++) {
            const result = results[j];
            const tx = batchTransactions[j];
            
            if (result && tx) {
              await adminClient
                .from("categorized_transactions")
                .update({
                  category: result.category || "Uncategorized",
                  subcategory: result.subcategory || null,
                  confidence_score: result.confidenceScore || 0.5,
                })
                .eq("id", tx.id);
            }
          }
        } catch (error: any) {
          console.error(`[AI Categorization] Error categorizing batch ${i / BATCH_SIZE + 1}:`, error);
          // Fallback to keyword matching for this batch
          await categorizeWithKeywordMatching(batchTransactions, mappings, adminClient);
        }
      }
      
      return; // Successfully used AI categorization
    } catch (error: any) {
      console.error("[AI Categorization] Failed to use AI categorization, falling back to keyword matching:", error);
      // Fall through to keyword matching fallback
    }
  }
  
  // Fallback to keyword matching if AI is not enabled or failed
  await categorizeWithKeywordMatching(transactions, mappings, adminClient);
}

/**
 * Fallback categorization using keyword matching
 */
async function categorizeWithKeywordMatching(
  transactions: any[],
  mappings: any[],
  adminClient: any
): Promise<void> {
  for (const tx of transactions) {
    let category: string | undefined;
    let subcategory: string | undefined;
    let confidenceScore = 0.5;

    // Skip if transaction doesn't have a description
    if (!tx.original_description) {
      continue;
    }

    // Check user mappings first
    if (mappings && mappings.length > 0) {
      for (const mapping of mappings) {
        const pattern = (mapping.pattern || "").toLowerCase();
        const description = (tx.original_description || "").toLowerCase();
        
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
      const desc = (tx.original_description || "").toLowerCase();
      
      if (desc.includes("office") || desc.includes("supplies") || desc.includes("printer") || desc.includes("equipment")) {
        category = "Office Supplies";
        confidenceScore = 0.7;
      } else if (desc.includes("software") || desc.includes("saas") || desc.includes("subscription")) {
        category = "Software & Subscriptions";
        confidenceScore = 0.7;
      } else if (desc.includes("amazon") || desc.includes("shopping") || desc.includes("retail")) {
        category = "Shopping";
        confidenceScore = 0.7;
      } else {
        category = "Uncategorized";
        confidenceScore = 0.3;
      }
    }

    // Update transaction with category
    await adminClient
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
  adminClient: any
): Promise<void> {
  try {
    // Get the invoice document details
    const { data: invoiceDoc, error: docError } = await adminClient
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
    const { data: transactions, error: txError } = await adminClient
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
            const { error: matchError } = await adminClient.rpc("match_transaction_with_document", {
              p_transaction_id: tx.id,
              p_document_id: invoiceDocumentId,
            });

            if (!matchError) {
              matchedCount++;
              // Create G/L breakdown entries for the matched receipt
              await createGLBreakdownFromReceipt(invoiceDoc, tx.id, jobId, adminClient);
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
  adminClient: any
): Promise<void> {
  try {
    // Get the matched transaction to inherit bank_account_id and other fields
    const { data: parentTx, error: txError } = await adminClient
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
      const { error: insertError } = await adminClient
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

