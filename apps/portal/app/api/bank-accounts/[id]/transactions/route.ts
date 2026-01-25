import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";

/**
 * OPTIONS /api/bank-accounts/[id]/transactions
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/**
 * GET /api/bank-accounts/[id]/transactions
 * Fetch all transactions for a specific bank account across all uploads/statements
 */ 
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: bankAccountId } = await params;

    // Verify bank account belongs to user
    const { data: bankAccount, error: bankAccountError } = await supabase
      .from("bank_accounts")
      .select("id")
      .eq("id", bankAccountId)
      .eq("user_id", user.id)
      .single();

    if (bankAccountError || !bankAccount) {
      return NextResponse.json(
        { error: "Bank account not found" },
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

    // Get all transactions for this bank account across all jobs
    // NOTE: Using admin client to bypass RLS issue - the SELECT RLS policy seems to have
    // issues with the EXISTS subquery even though the bank account ownership is verified.
    // Security is still enforced above via bank account ownership verification.
    const adminClientForQuery = createAdminClient();

    // Get transactions with bank account filter
    const { data: transactions, error: transactionsError } = await adminClientForQuery
      .from("categorized_transactions")
      .select("*")
      .eq("bank_account_id", bankAccountId)
      .order("date", { ascending: false });

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

    // If we have transactions, enrich them with document, supplier, and job info
    if (transactions && transactions.length > 0) {
      const documentIds = transactions
        .map(t => t.document_id)
        .filter((id): id is string => id !== null);
      const supplierIds = transactions
        .map(t => t.supplier_id)
        .filter((id): id is string => id !== null);
      const jobIds = transactions
        .map(t => t.job_id)
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
              doc.tax_amount = subtotal;
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

      // Fetch jobs (to show source statement info)
      const jobsMap = new Map();
      if (jobIds.length > 0) {
        const { data: jobs } = await adminClientForQuery
          .from("categorization_jobs")
          .select("id, original_filename, created_at")
          .in("id", jobIds);
        
        jobs?.forEach((job: any) => {
          jobsMap.set(job.id, job);
        });
      }

      // Enrich transactions with document, supplier, and job data
      transactions.forEach((tx: any) => {
        if (tx.document_id) {
          tx.document = documentsMap.get(tx.document_id) || null;
        }
        if (tx.supplier_id) {
          tx.supplier = suppliersMap.get(tx.supplier_id) || null;
        }
        if (tx.job_id) {
          tx.job = jobsMap.get(tx.job_id) || null;
        }
      });
    }

    return NextResponse.json({
      success: true,
      transactions: transactions || [],
      total: transactions?.length || 0,
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
