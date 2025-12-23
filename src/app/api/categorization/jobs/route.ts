import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
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
        updated_at,
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

    // Transform jobs to match the expected format
    const transformedJobs = (jobs || []).map((job: any) => ({
      id: job.id,
      file_name: job.original_filename || "Untitled",
      status: job.status,
      total_items: job.total_items || 0,
      processed_items: job.processed_items || 0,
      created_at: job.created_at,
      updated_at: job.updated_at || job.completed_at || job.created_at,
    }));

    // Get total count for pagination
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error: countError } = await (supabase as any)
      .from("categorization_jobs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      jobs: transformedJobs,
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

