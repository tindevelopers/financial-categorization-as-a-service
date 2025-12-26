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
          })
          .eq("id", doc.id);

        // Convert invoice to transactions
        const transactions = await invoiceToTransactions(invoiceData, jobId, supabase);

        // Insert transactions
        if (transactions.length > 0) {
          const { error: txError } = await supabase
            .from("categorized_transactions")
            .insert(transactions);

          if (txError) {
            console.error("Transaction insert error:", txError);
          } else {
            // Categorize the transactions (basic rule-based for now)
            await categorizeInvoiceTransactions(transactions, user.id, supabase);
          }
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
