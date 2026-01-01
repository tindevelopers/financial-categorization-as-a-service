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
    let { data: { user }, error: authError } = await supabase.auth.getUser();
    // Fallback: accept bearer token when cookies are missing (some browser/env combinations)
    if ((!user || authError) && request.headers.get("authorization")) {
      const authHeader = request.headers.get("authorization") || "";
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match?.[1]) {
        const bearer = match[1];
        const fallback = await supabase.auth.getUser(bearer);
        user = fallback.data.user;
        authError = fallback.error;
      }
    }

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
      console.error("Error deleting transactions:", deleteError);      return NextResponse.json(
        { error: "Failed to delete transactions", details: deleteError.message },
        { status: 500 }
      );
    }
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
    let { data: { user }, error: authError } = await supabase.auth.getUser();

    // Fallback: accept bearer token when cookies are missing (some browser/env combinations)
    if ((!user || authError) && request.headers.get("authorization")) {
      const authHeader = request.headers.get("authorization") || "";
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match?.[1]) {
        const bearer = match[1];
        const fallback = await supabase.auth.getUser(bearer);
        user = fallback.data.user;
        authError = fallback.error;
      }
    }

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
    const adminClientForQuery = createAdminClient();    // Get transactions
    const { data: transactions, error: transactionsError } = await adminClientForQuery
      .from("categorized_transactions")
      .select("*")
      .eq("job_id", jobId)
      .order("date", { ascending: false });
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
          if ((documentsError as any)?.code === "42703" && missingCol && docSelectColumns.includes(missingCol)) {
            docSelectColumns = docSelectColumns.filter((c) => c !== missingCol);
            continue;
          }

          break;
        }        
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
              doc.tax_amount = subtotal;            }
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
      });    }

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
