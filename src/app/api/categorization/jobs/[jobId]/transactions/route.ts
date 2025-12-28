import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";

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
        { status: 401 }
      );
    }

    const { jobId } = await params;

    // Verify job belongs to user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: job, error: jobError } = await (supabase as any)
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

    // Get transactions with complete document information
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: transactions, error: transactionsError } = await (supabase as any)
      .from("categorized_transactions")
      .select(`
        *,
        document:financial_documents!document_id (
          id,
          original_filename,
          supabase_path,
          storage_tier,
          mime_type,
          vendor_name,
          invoice_number,
          po_number,
          order_number,
          document_date,
          delivery_date,
          paid_date,
          total_amount,
          tax_amount,
          subtotal_amount,
          fee_amount,
          shipping_amount,
          currency,
          line_items,
          payment_method,
          extracted_data,
          ocr_field_confidence,
          ocr_extraction_methods,
          ocr_needs_review,
          ocr_confidence_score,
          notes
        )
      `)
      .eq("job_id", jobId)
      .order("date", { ascending: false });

    if (transactionsError) {
      return NextResponse.json(
        { error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    // Map database column names to component-friendly names
    const mappedTransactions = (transactions || []).map((tx: any) => {
      if (tx.document) {
        tx.document.field_confidence = tx.document.ocr_field_confidence;
        tx.document.extraction_methods = tx.document.ocr_extraction_methods;
        tx.document.needs_review = tx.document.ocr_needs_review;
      }
      return tx;
    });

    return NextResponse.json({
      success: true,
      transactions: mappedTransactions,
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
