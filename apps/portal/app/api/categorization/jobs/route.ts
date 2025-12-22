import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

/**
 * GET /api/categorization/jobs
 * List all categorization jobs for the current user with optional filters
 * Query params:
 *  - status: filter by status (uploaded, processing, completed, failed)
 *  - job_type: filter by type (spreadsheet, invoice, batch_invoice)
 *  - limit: number of results (default: 50, max: 100)
 *  - offset: pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const jobType = searchParams.get("job_type");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = supabase
      .from("categorization_jobs")
      .select(`
        id,
        job_type,
        status,
        processing_mode,
        original_filename,
        file_url,
        cloud_storage_provider,
        total_items,
        processed_items,
        failed_items,
        created_at,
        started_at,
        completed_at,
        error_message
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }
    if (jobType) {
      query = query.eq("job_type", jobType);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: jobs, error: jobsError } = await query;

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      return NextResponse.json(
        { error: "Failed to fetch jobs" },
        { status: 500 }
      );
    }

    // Get financial documents for these jobs to include storage info
    const jobIds = jobs?.map(j => j.id) || [];
    const { data: documents } = await supabase
      .from("financial_documents")
      .select("job_id, storage_tier, archived_at, file_size_bytes")
      .in("job_id", jobIds);

    // Create a map of job_id -> document info
    const docMap = new Map();
    documents?.forEach(doc => {
      if (!docMap.has(doc.job_id)) {
        docMap.set(doc.job_id, []);
      }
      docMap.get(doc.job_id).push(doc);
    });

    // Enhance jobs with storage info
    const enhancedJobs = jobs?.map(job => {
      const jobDocs = docMap.get(job.id) || [];
      const storageTiers = jobDocs.map(d => d.storage_tier);
      const totalSize = jobDocs.reduce((sum, d) => sum + (d.file_size_bytes || 0), 0);
      
      return {
        ...job,
        storage_info: {
          tier: storageTiers.includes("archive") ? "archive" : 
                storageTiers.includes("restoring") ? "restoring" : "hot",
          total_size_bytes: totalSize,
          document_count: jobDocs.length,
          archived_at: jobDocs.find(d => d.archived_at)?.archived_at || null,
        }
      };
    });

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from("categorization_jobs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      jobs: enhancedJobs || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      }
    });
  } catch (error: any) {
    console.error("Error in jobs endpoint:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

