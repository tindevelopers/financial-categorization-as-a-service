import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

/**
 * GET /api/categorization/jobs/[jobId]/documents
 * Get all documents for a specific job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
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

    const { jobId } = await params;

    // Fetch documents for this job
    const { data: documents, error: docsError } = await supabase
      .from("financial_documents")
      .select("id, original_filename, vendor_name, total_amount, document_date, ocr_status, file_type")
      .eq("job_id", jobId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (docsError) {
      console.error("Error fetching documents:", docsError);
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      documents: documents || [],
      count: documents?.length || 0,
    });

  } catch (error: any) {
    console.error("Error in /api/categorization/jobs/[jobId]/documents:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
