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
              await reconcileInvoiceAfterProcessing(doc.id, insertedTransactionIds, user.id, supabase);
            }
          }
        } else {
          // Even if no transactions were created, try to reconcile the invoice document
          await reconcileInvoiceAfterProcessing(doc.id, [], user.id, supabase);
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
