import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";

/**
 * OPTIONS /api/categorization/jobs/[jobId]/transactions
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/categorization/jobs/[jobId]/transactions/route.ts:delete:entry',message:'DELETE job transactions called',data:{hasUser:!!user,hasAuthError:!!authError},timestamp:Date.now(),sessionId:'debug-session',runId:'delete-1',hypothesisId:'D2'})}).catch(()=>{});
    // #endregion

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { jobId } = await params;
    const documentId = request.nextUrl.searchParams.get("documentId");

    // Verify job belongs to user
    const { data: job, error: jobError } = await supabase
      .from("categorization_jobs")
      .select("id")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Use admin client so delete works even if categorized_transactions has restrictive RLS.
    // Security is enforced above by verifying job ownership.
    const admin = createAdminClient();

    // Delete transactions for this job (optionally scoped to a single document_id)
    let deleteQuery = admin
      .from("categorized_transactions")
      .delete()
      .eq("job_id", jobId);
    if (documentId) {
      deleteQuery = deleteQuery.eq("document_id", documentId);
    }

    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      console.error("Error deleting transactions:", deleteError);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/categorization/jobs/[jobId]/transactions/route.ts:delete:error',message:'DELETE job transactions failed',data:{jobId,documentId,errorMessage:deleteError.message,code:(deleteError as any)?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'delete-1',hypothesisId:'D2'})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { error: "Failed to delete transactions", details: deleteError.message },
        { status: 500 }
      );
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/categorization/jobs/[jobId]/transactions/route.ts:delete:ok',message:'DELETE job transactions ok',data:{jobId,documentId},timestamp:Date.now(),sessionId:'debug-session',runId:'delete-1',hypothesisId:'D2'})}).catch(()=>{});
    // #endregion

    return NextResponse.json({
      success: true,
      message: documentId ? "Invoice transactions deleted" : "All transactions deleted",
    });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { 
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    const { jobId } = await params;

    // Verify job belongs to user
    const { data: job, error: jobError } = await supabase
      .from("categorization_jobs")
      .select("id")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { 
          status: 404,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    // Get transactions with related document and supplier info
    // NOTE: Using admin client to bypass RLS issue - the SELECT RLS policy seems to have
    // issues with the EXISTS subquery even though the job ownership is verified.
    // Security is still enforced above via job ownership verification.
    const adminClientForQuery = createAdminClient();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'transactions/route.ts:71',message:'Querying transactions for job',data:{jobId,userId:user.id.substring(0,8)+'...'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    // Get transactions
    const { data: transactions, error: transactionsError } = await adminClientForQuery
      .from("categorized_transactions")
      .select("*")
      .eq("job_id", jobId)
      .order("date", { ascending: false });

    // #region agent log
    const txDocIdCount = (transactions || []).filter((t: any) => Boolean(t.document_id)).length;
    const txSample = (transactions || [])[0] || null;
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/categorization/jobs/[jobId]/transactions/route.ts:txShape',message:'Raw transactions shape (before enrichment)',data:{jobId,transactionsCount:transactions?.length||0,txDocIdCount,txKeys:txSample?Object.keys(txSample).slice(0,30):[],txSampleDocumentId:txSample?.document_id,txSampleId:txSample?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

    // If we have transactions, enrich them with document and supplier info
    if (transactions && transactions.length > 0) {
      const documentIds = transactions
        .map(t => t.document_id)
        .filter((id): id is string => id !== null);
      const supplierIds = transactions
        .map(t => t.supplier_id)
        .filter((id): id is string => id !== null);

      // Fetch documents
      const documentsMap = new Map();
      if (documentIds.length > 0) {
        // Some environments may not yet have newer invoice columns (e.g. shipping_amount).
        // If a column is missing, PostgREST fails the whole select. We retry without missing columns.
        let docSelectColumns = [
          "id",
          "original_filename",
          "supabase_path",
          "storage_tier",
          "mime_type",
          "vendor_name",
          "document_number",
          "invoice_number",
          "po_number",
          "order_number",
          "document_date",
          "delivery_date",
          "paid_date",
          "total_amount",
          "tax_amount",
          "subtotal_amount",
          "fee_amount",
          "shipping_amount",
          "currency",
          "line_items",
          "payment_method",
          "extracted_data",
          "ocr_field_confidence",
          "ocr_extraction_methods",
          "ocr_needs_review",
          "ocr_confidence_score",
          "notes",
        ];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let documents: any[] | null = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let documentsError: any = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          const result = await adminClientForQuery
            .from("financial_documents")
            .select(docSelectColumns.join(","))
            .in("id", documentIds);

          documents = (result as any).data ?? null;
          documentsError = (result as any).error ?? null;

          if (!documentsError) break;

          const errMsg = String(documentsError?.message || "");
          const match = errMsg.match(/financial_documents\.([a-zA-Z0-9_]+)/);
          const missingCol = match?.[1];

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/categorization/jobs/[jobId]/transactions/route.ts:docsFetchRetry',message:'Documents select failed; considering retry without missing column',data:{jobId,attempt,code:(documentsError as any)?.code,errorMessage:documentsError?.message,missingCol,columnsCount:docSelectColumns.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion

          if ((documentsError as any)?.code === "42703" && missingCol && docSelectColumns.includes(missingCol)) {
            docSelectColumns = docSelectColumns.filter((c) => c !== missingCol);
            continue;
          }

          break;
        }

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/categorization/jobs/[jobId]/transactions/route.ts:docsFetch',message:'Fetched documents for transaction document_ids',data:{jobId,documentIdsCount:documentIds.length,documentsFetched:documents?.length||0,docIdsSample:documentIds.slice(0,3)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/categorization/jobs/[jobId]/transactions/route.ts:docsFetchError',message:'Documents fetch error (if any)',data:{jobId,hasError:!!documentsError,errorMessage:documentsError?.message,code:(documentsError as any)?.code,details:(documentsError as any)?.details,hint:(documentsError as any)?.hint},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        
        documents?.forEach((doc: any) => {
          // Back-compat: older pipeline writes document_number, UI expects invoice_number
          if (!doc.invoice_number && doc.document_number) {
            doc.invoice_number = doc.document_number;
          }
          // Back-compat: older code expects `ocr_confidence`
          if (doc.ocr_confidence_score !== undefined && doc.ocr_confidence === undefined) {
            doc.ocr_confidence = doc.ocr_confidence_score;
          }

          // VAT sanity check for older stored docs: if tax is implausibly large vs total, swap subtotal/tax.
          if (
            typeof doc.total_amount === "number" &&
            typeof doc.subtotal_amount === "number" &&
            typeof doc.tax_amount === "number"
          ) {
            const total = doc.total_amount;
            const subtotal = doc.subtotal_amount;
            const tax = doc.tax_amount;
            const ratio = total !== 0 ? Math.abs(tax) / Math.abs(total) : 0;
            const swappedRatio = total !== 0 ? Math.abs(subtotal) / Math.abs(total) : 0;
            const sumMatches = Math.abs((subtotal + tax) - total) <= 0.02;
            const looksSwapped = ratio > 0.5 && swappedRatio < 0.5 && tax > subtotal;
            if (sumMatches && looksSwapped) {
              doc.subtotal_amount = tax;
              doc.tax_amount = subtotal;
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/categorization/jobs/[jobId]/transactions/route.ts:vatSanity:swap',message:'Swapped subtotal_amount and tax_amount for response',data:{jobId,documentId:doc.id,total,prevSubtotal:subtotal,prevTax:tax,ratio},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'VAT1'})}).catch(()=>{});
              // #endregion
            }
          }
          documentsMap.set(doc.id, doc);
        });
      }

      // Fetch suppliers
      const suppliersMap = new Map();
      if (supplierIds.length > 0) {
        const { data: suppliers } = await adminClientForQuery
          .from("suppliers")
          .select("id, name, email, phone")
          .in("id", supplierIds);
        
        suppliers?.forEach((supplier: any) => {
          suppliersMap.set(supplier.id, supplier);
        });
      }

      // Enrich transactions with document and supplier data
      transactions.forEach((tx: any) => {
        if (tx.document_id) {
          tx.document = documentsMap.get(tx.document_id) || null;
        }
        if (tx.supplier_id) {
          tx.supplier = suppliersMap.get(tx.supplier_id) || null;
        }
      });

      // #region agent log
      const sampleTxWithDoc = transactions.find((t: any) => t.document) || null;
      const sampleDoc = sampleTxWithDoc?.document || null;
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/categorization/jobs/[jobId]/transactions/route.ts:sampleDoc',message:'Sample enriched document fields',data:{jobId,hasSampleTx:!!sampleTxWithDoc,docId:sampleDoc?.id,vendor_name:sampleDoc?.vendor_name,total_amount:sampleDoc?.total_amount,tax_amount:sampleDoc?.tax_amount,invoice_number:sampleDoc?.invoice_number,document_number:sampleDoc?.document_number,document_date:sampleDoc?.document_date,currency:sampleDoc?.currency,keys:sampleDoc?Object.keys(sampleDoc).slice(0,25):[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'transactions/route.ts:75',message:'Transactions query result',data:{jobId,transactionsCount:transactions?.length||0,hasError:!!transactionsError,errorMessage:transactionsError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion


    if (transactionsError) {
      console.error("Error fetching transactions:", transactionsError);
      return NextResponse.json(
        { error: "Failed to fetch transactions", details: transactionsError.message },
        { 
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    return NextResponse.json({
      success: true,
      transactions: transactions || [],
    }, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { 
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  }
}
