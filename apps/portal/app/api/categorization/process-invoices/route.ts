import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { processInvoiceOCR } from "@/lib/ocr/google-document-ai";


import type { InvoiceData } from "@/lib/ocr/google-document-ai";

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

    // Get documents for this job
    const { data: documents, error: docsError } = await supabase
      .from("financial_documents")
      .select("*")
      .eq("job_id", jobId)
      .in("ocr_status", ["pending", "failed"]); // Also retry failed ones

    if (docsError || !documents || documents.length === 0) {
      await supabase
        .from("categorization_jobs")
        .update({ 
          status: "failed",
          error_message: "No documents found for processing",
        })
        .eq("id", jobId);
      
      return NextResponse.json(
        { error: "No documents found" },
        { status: 400 }
      );
    }

    let processedCount = 0;
    let failedCount = 0;

    // Process each document
    for (const doc of documents) {
      try {
        // Update document status
        await supabase
          .from("financial_documents")
          .update({ ocr_status: "processing" })
          .eq("id", doc.id);

        // Download file from storage
        const fileName = doc.original_filename;
        const filePath = doc.supabase_path || `${user.id}/invoices/${fileName.split("-").slice(1).join("-")}`;
        
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("categorization-uploads")
          .download(filePath);

        if (downloadError || !fileData) {
          throw new Error(`Failed to download file: ${fileName}`);
        }

        // Process OCR using the utility function
        const invoiceData = await processInvoiceOCR(fileData, fileName);

        // Verify OCR source before updating
        const { verifyOCRSource } = await import("@/lib/ocr/google-document-ai");
        const ocrVerification = verifyOCRSource();
        
        // Update document with extracted data
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
            ocr_provider: ocrVerification.provider, // Explicitly set OCR provider
          })
          .eq("id", doc.id);

        // Convert invoice to transactions
        const transactions = await invoiceToTransactions(invoiceData, jobId, supabase);

        // Insert transactions
        let insertedTransactionIds: string[] = [];
        if (transactions.length > 0) {
          const { data: insertedTransactions, error: txError } = await supabase
            .from("categorized_transactions")
            .insert(transactions)
            .select("id");

          if (txError) {
            console.error("Transaction insert error:", txError);
          } else {
            insertedTransactionIds = insertedTransactions?.map((t: any) => t.id) || [];
            // Categorize the transactions (basic rule-based for now)
            await categorizeInvoiceTransactions(insertedTransactions || transactions, user.id, supabase);
            
            // Attempt automatic reconciliation after transactions are created
            if (insertedTransactionIds.length > 0) {
              await reconcileInvoiceAfterProcessing(doc.id, insertedTransactionIds, user.id, jobId, supabase);
            }
          }
        } else {
          // Even if no transactions were created, try to reconcile the invoice document
          await reconcileInvoiceAfterProcessing(doc.id, [], user.id, jobId, supabase);
        }

        processedCount++;
      } catch (error: any) {
        console.error(`Error processing document ${doc.id}:`, error);
        failedCount++;

        await supabase
          .from("financial_documents")
          .update({
            ocr_status: "failed",
          })
          .eq("id", doc.id);
      }
    }

    // Update job status
    const finalStatus = failedCount === documents.length ? "failed" : "reviewing";
    await supabase
      .from("categorization_jobs")
      .update({ 
        status: finalStatus,
        processed_items: processedCount,
        failed_items: failedCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return NextResponse.json({
      success: true,
      jobId,
      processed: processedCount,
      failed: failedCount,
      message: `Processed ${processedCount} invoice${processedCount !== 1 ? "s" : ""}`,
    });
  } catch (error: any) {
    console.error("Process invoices error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}


async function invoiceToTransactions(
  invoiceData: InvoiceData, 
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
  const transactions: any[] = [];

  // Build description components
  const vendorName = invoiceData.vendor_name || invoiceData.supplier?.name || "Vendor";
  const invoiceNumber = invoiceData.invoice_number || invoiceData.order_number;
  const invoiceRef = invoiceNumber ? `Invoice #${invoiceNumber}` : null;
  
  // If we have line items, create a transaction for each
  if (invoiceData.line_items && invoiceData.line_items.length > 0) {
    for (const item of invoiceData.line_items) {
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
        amount: item.total,
        date: invoiceData.invoice_date || new Date().toISOString().split("T")[0],
        category: null,
        subcategory: null,
        confidence_score: 0.5,
        user_confirmed: false,
        bank_account_id: bankAccountId,
        invoice_number: invoiceNumber || null,
        supplier_id: null, // Will be set by caller if needed
        document_id: null, // Will be set by caller if needed
      });
    }
  } else if (invoiceData.total) {
    // Single transaction for entire invoice
    // Build description: Vendor - Invoice #Number (or just Vendor if no invoice number)
    const descriptionParts = [vendorName];
    if (invoiceRef) {
      descriptionParts.push(invoiceRef);
    }
    const fullDescription = descriptionParts.join(" - ");
    
    transactions.push({
      job_id: jobId,
      original_description: fullDescription,
      amount: invoiceData.total,
      date: invoiceData.invoice_date || new Date().toISOString().split("T")[0],
      category: null,
      subcategory: null,
      confidence_score: 0.5,
      user_confirmed: false,
      bank_account_id: bankAccountId,
      invoice_number: invoiceNumber || null,
      supplier_id: null, // Will be set by caller if needed
      document_id: null, // Will be set by caller if needed
    });
  }

  return transactions;
}

async function categorizeInvoiceTransactions(
  transactions: any[],
  userId: string,
  supabase: any
): Promise<void> {
  if (!transactions || transactions.length === 0) {
    return;
  }

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
      const { VercelAICategorizationService } = await import("@/lib/ai/VercelAICategorizationService");
      const provider = AICategorizationFactory.getDefaultProvider();
      
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
      const aiTransactions = transactions.map(tx => ({
        original_description: tx.original_description || tx.description || "Invoice transaction",
        amount: tx.amount || 0,
        date: typeof tx.date === "string" ? tx.date : (tx.date?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0]),
      }));

      // Categorize in batches (process 20 at a time to avoid token limits)
      const BATCH_SIZE = 20;
      for (let i = 0; i < aiTransactions.length; i += BATCH_SIZE) {
        const batch = aiTransactions.slice(i, i + BATCH_SIZE);
        const batchTransactions = transactions.slice(i, i + BATCH_SIZE);
        
        try {
          const results = await aiService.categorizeBatch(batch);
          
          // Update each transaction with AI categorization results
          for (let j = 0; j < results.length && j < batchTransactions.length; j++) {
            const result = results[j];
            const tx = batchTransactions[j];
            
            if (result && tx) {
              await supabase
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
          await categorizeWithKeywordMatching(batchTransactions, mappings, supabase);
        }
      }
      
      return; // Successfully used AI categorization
    } catch (error: any) {
      console.error("[AI Categorization] Failed to use AI categorization, falling back to keyword matching:", error);
      // Fall through to keyword matching fallback
    }
  }
  
  // Fallback to keyword matching if AI is not enabled or failed
  await categorizeWithKeywordMatching(transactions, mappings, supabase);
}

/**
 * Fallback categorization using keyword matching
 */
async function categorizeWithKeywordMatching(
  transactions: any[],
  mappings: any[],
  supabase: any
): Promise<void> {
  for (const tx of transactions) {
    let category: string | undefined;
    let subcategory: string | undefined;
    let confidenceScore = 0.5;

    // Check user mappings first
    if (mappings && mappings.length > 0) {
      for (const mapping of mappings) {
        const pattern = mapping.pattern.toLowerCase();
        const description = (tx.original_description || tx.description || "").toLowerCase();
        
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
      const desc = (tx.original_description || tx.description || "").toLowerCase();
      
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

    // 1. Try to match invoice document with existing bank transactions
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
            // Attempt to match
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

    // 2. Try to match invoice transactions with existing documents (receipts, other invoices)
    if (invoiceTransactionIds.length > 0 && matchedCount === 0) {
      const { data: documents, error: docMatchError } = await supabase
        .from("financial_documents")
        .select("*")
        .eq("user_id", userId)
        .eq("reconciliation_status", "unreconciled")
        .is("matched_transaction_id", null)
        .neq("id", invoiceDocumentId) // Exclude the invoice itself
        .neq("file_type", "invoice") // Focus on receipts and other documents
        .order("document_date", { ascending: false });

      if (!docMatchError && documents) {
        for (const txId of invoiceTransactionIds) {
          const { data: tx, error: txFetchError } = await supabase
            .from("categorized_transactions")
            .select("*")
            .eq("id", txId)
            .single();

          if (txFetchError || !tx || tx.matched_document_id) continue;

          for (const doc of documents) {
            if (doc.matched_transaction_id) continue;

            const amountDiff = Math.abs((tx.amount || 0) - (doc.total_amount || 0));
            const dateDiff = doc.document_date
              ? Math.abs(
                  (new Date(tx.date).getTime() - new Date(doc.document_date).getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              : 999;

            if (amountDiff < 0.01 && dateDiff <= 7) {
              const descriptionScore = calculateDescriptionMatch(
                tx.original_description,
                doc.vendor_name || doc.original_filename
              );

              const totalScore =
                (100 - amountDiff) * 0.5 + (100 - dateDiff) * 0.3 + descriptionScore * 0.2;

              if (totalScore >= 80) {
                const { error: matchError } = await supabase.rpc(
                  "match_transaction_with_document",
                  {
                    p_transaction_id: txId,
                    p_document_id: doc.id,
                  }
                );

                if (!matchError) {
                  matchedCount++;
                  break;
                }
              }
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

// Helper function to calculate description similarity (same as in auto-match route)
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
