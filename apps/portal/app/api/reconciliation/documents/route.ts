import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

/**
 * GET /api/reconciliation/documents
 * Fetch all available invoices/receipts for manual matching
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch all financial documents for this user that have been processed
    // and have financial data extracted (total_amount)
    // Include documents with any ocr_status as long as they have data
    const { data: documents, error: documentsError } = await supabase
      .from("financial_documents")
      .select(`
        id,
        original_filename,
        vendor_name,
        total_amount,
        subtotal_amount,
        tax_amount,
        fee_amount,
        tax_rate,
        line_items,
        document_date,
        file_type,
        ocr_status
      `)
      .eq("user_id", user.id)
      .not("total_amount", "is", null)
      .order("document_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (documentsError) {
      console.error("Error fetching documents:", documentsError);
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    console.log(`[reconciliation/documents] Found ${documents?.length || 0} documents for user ${user.id}`);
    if (documents && documents.length > 0) {
      console.log(`[reconciliation/documents] Sample document:`, {
        id: documents[0].id,
        filename: documents[0].original_filename,
        vendor: documents[0].vendor_name,
        amount: documents[0].total_amount,
        status: documents[0].ocr_status
      });
    }

    // Format documents for dropdown
    const formattedDocuments = (documents || []).map((doc) => ({
      id: doc.id,
      original_filename: doc.original_filename,
      vendor_name: doc.vendor_name,
      total_amount: doc.total_amount,
      subtotal_amount: doc.subtotal_amount,
      tax_amount: doc.tax_amount,
      fee_amount: doc.fee_amount,
      tax_rate: doc.tax_rate,
      line_items: doc.line_items,
      document_date: doc.document_date,
      file_type: doc.file_type,
    }));

    return NextResponse.json({
      documents: formattedDocuments,
      count: formattedDocuments.length,
    });

  } catch (error: any) {
    console.error("Error in /api/reconciliation/documents:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
