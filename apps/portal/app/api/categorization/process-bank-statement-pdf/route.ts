import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";
import { processBankStatementOCR, type BankStatementData } from "@/lib/ocr/bank-statement-ocr";
import { verifyOCRSource } from "@/lib/ocr/google-document-ai";
import { createHash } from "crypto";

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

    // Verify OCR is configured
    const ocrVerification = verifyOCRSource();
    if (!ocrVerification.configured) {
      return NextResponse.json(
        { error: "OCR not configured. Please configure Google Document AI credentials." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const bankAccountId = formData.get("bank_account_id") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported for bank statements" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    // Validate bank account
    if (!bankAccountId) {
      return NextResponse.json(
        { error: "Bank account ID is required" },
        { status: 400 }
      );
    }

    const { data: bankAccount, error: bankAccountError } = await supabase
      .from("bank_accounts")
      .select("id, account_name, user_id")
      .eq("id", bankAccountId)
      .eq("user_id", user.id)
      .single();

    if (bankAccountError || !bankAccount) {
      return NextResponse.json(
        { error: "Invalid bank account" },
        { status: 400 }
      );
    }

    // Convert file to buffer and calculate hash
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256").update(fileBuffer).digest("hex");

    // Check for duplicate files
    const { data: existingDoc } = await supabase
      .from("financial_documents")
      .select("id, job_id")
      .eq("file_hash", fileHash)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingDoc) {
      return NextResponse.json(
        {
          error: "This file has already been uploaded",
          existingDocumentId: existingDoc.id,
          existingJobId: existingDoc.job_id,
        },
        { status: 409 }
      );
    }

    // Upload file to storage
    const filePath = `${user.id}/bank-statements/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("categorization-uploads")
      .upload(filePath, fileBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("File upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Create categorization job
    const { data: job, error: jobError } = await supabase
      .from("categorization_jobs")
      .insert({
        user_id: user.id,
        job_type: "bank_statement_pdf",
        original_filename: file.name,
        status: "processing",
        bank_account_id: bankAccountId,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error("Job creation error:", jobError);
      return NextResponse.json(
        { error: "Failed to create processing job" },
        { status: 500 }
      );
    }

    // Create financial_document entry
    const { data: document, error: docError } = await supabase
      .from("financial_documents")
      .insert({
        user_id: user.id,
        job_id: job.id,
        original_filename: file.name,
        file_type: "bank_statement",
        mime_type: "application/pdf",
        file_size_bytes: file.size,
        file_hash: fileHash,
        supabase_path: filePath,
        ocr_status: "processing",
        ocr_provider: ocrVerification.provider,
        bank_account_id: bankAccountId,
      })
      .select()
      .single();

    if (docError || !document) {
      console.error("Document creation error:", docError);
      return NextResponse.json(
        { error: "Failed to create document record" },
        { status: 500 }
      );
    }

    // Process OCR to extract transactions
    const fileBlob = new Blob([fileBuffer], { type: "application/pdf" });
    const bankStatementData = await processBankStatementOCR(fileBlob, file.name);

    // Update document with extracted data
    await supabase
      .from("financial_documents")
      .update({
        ocr_status: bankStatementData.transactions.length > 0 ? "completed" : "failed",
        ocr_confidence_score: bankStatementData.confidence_score || 0.5,
        extracted_text: bankStatementData.extracted_text || null,
        document_date: bankStatementData.statement_period_end || null,
        period_start: bankStatementData.statement_period_start || null,
        period_end: bankStatementData.statement_period_end || null,
        vendor_name: bankStatementData.account_holder || null,
        document_number: bankStatementData.account_number || null,
      })
      .eq("id", document.id);

    // Convert extracted transactions to categorized_transactions format
    const transactions = bankStatementData.transactions.map((tx) => ({
      job_id: job.id,
      original_description: tx.description,
      amount: tx.type === "debit" ? -Math.abs(tx.amount) : Math.abs(tx.amount), // Negative for debits
      date: tx.date,
      category: null,
      subcategory: null,
      confidence_score: bankStatementData.confidence_score || 0.5,
      user_confirmed: false,
      bank_account_id: bankAccountId,
      source_type: "bank_statement_pdf",
      source_identifier: file.name,
    }));

    let insertedTransactionIds: string[] = [];

    // Insert transactions
    if (transactions.length > 0) {
      const adminClient = createAdminClient();
      const { data: insertedTransactions, error: txError } = await adminClient
        .from("categorized_transactions")
        .insert(transactions)
        .select("id");

      if (txError) {
        console.error("Transaction insert error:", txError);
      } else {
        insertedTransactionIds = insertedTransactions?.map((t: any) => t.id) || [];

        // Update job with transaction count
        await supabase
          .from("categorization_jobs")
          .update({
            total_items: transactions.length,
            processed_items: insertedTransactionIds.length,
            status: "reviewing",
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        // Attempt automatic reconciliation
        if (insertedTransactionIds.length > 0) {
          await attemptReconciliationForTransactions(
            insertedTransactionIds,
            document.id,
            user.id,
            supabase
          );
        }
      }
    } else {
      // No transactions extracted
      await supabase
        .from("categorization_jobs")
        .update({
          status: "failed",
          error_message: "No transactions extracted from bank statement",
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      documentId: document.id,
      transactionsExtracted: bankStatementData.transactions.length,
      transactionsInserted: insertedTransactionIds.length,
      statementPeriod: {
        start: bankStatementData.statement_period_start,
        end: bankStatementData.statement_period_end,
      },
      message: `Extracted ${bankStatementData.transactions.length} transaction(s) from bank statement`,
    });
  } catch (error: any) {
    console.error("Process bank statement PDF error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Attempt to reconcile extracted transactions with existing invoices/documents
 */
async function attemptReconciliationForTransactions(
  transactionIds: string[],
  bankStatementDocumentId: string,
  userId: string,
  supabase: any
): Promise<void> {
  try {
    let matchedCount = 0;

    // Get all transactions
    const { data: transactions, error: txError } = await supabase
      .from("categorized_transactions")
      .select("*")
      .in("id", transactionIds);

    if (txError || !transactions) return;

    // Get unreconciled invoices/documents for this user
    const { data: documents, error: docError } = await supabase
      .from("financial_documents")
      .select("*")
      .eq("user_id", userId)
      .eq("reconciliation_status", "unreconciled")
      .is("matched_transaction_id", null)
      .neq("id", bankStatementDocumentId) // Exclude the bank statement itself
      .order("document_date", { ascending: false });

    if (docError || !documents) return;

    // Try to match each transaction
    for (const tx of transactions) {
      if (tx.matched_document_id) continue;

      const txAmount = Math.abs(tx.amount || 0);
      const txDate = tx.date;

      for (const doc of documents) {
        if (doc.matched_transaction_id) continue;

        const docAmount = doc.total_amount || 0;
        const docDate = doc.document_date;

        const amountDiff = Math.abs(txAmount - docAmount);
        const dateDiff = txDate && docDate
          ? Math.abs(
              (new Date(txDate).getTime() - new Date(docDate).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 999;

        // High confidence match: exact amount within 7 days
        if (amountDiff < 0.01 && dateDiff <= 7) {
          const descriptionScore = calculateDescriptionMatch(
            tx.original_description,
            doc.vendor_name || doc.original_filename
          );

          const totalScore =
            (100 - amountDiff) * 0.5 + (100 - dateDiff) * 0.3 + descriptionScore * 0.2;

          if (totalScore >= 80) {
            // Attempt to match
            const { error: matchError } = await supabase.rpc(
              "match_transaction_with_document",
              {
                p_transaction_id: tx.id,
                p_document_id: doc.id,
              }
            );

            if (!matchError) {
              matchedCount++;
              break; // Transaction matched, move to next
            }
          }
        }
      }
    }

    if (matchedCount > 0) {
      console.log(
        `[Reconciliation] Auto-matched ${matchedCount} transaction(s) from PDF bank statement`
      );
    }
  } catch (error: any) {
    console.error("[Reconciliation] Error during auto-reconciliation:", error);
    // Don't throw - reconciliation failure shouldn't fail processing
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

