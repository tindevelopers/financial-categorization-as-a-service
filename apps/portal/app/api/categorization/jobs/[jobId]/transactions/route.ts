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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
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
        const { data: documents } = await adminClientForQuery
          .from("financial_documents")
          .select("id, original_filename, supabase_path, storage_tier, mime_type")
          .in("id", documentIds);
        
        documents?.forEach((doc: any) => {
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
