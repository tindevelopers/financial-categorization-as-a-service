import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";

// GET /api/exports - List all exportable jobs for the current user
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

    // Get all completed categorization jobs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: jobs, error: jobsError } = await (supabase as any)
      .from("categorization_jobs")
      .select(`
        id,
        job_type,
        status,
        original_filename,
        row_count,
        processed_count,
        created_at,
        updated_at
      `)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      return NextResponse.json(
        { error: "Failed to fetch jobs" },
        { status: 500 }
      );
    }

    // Get transaction counts for each job
    const jobsWithCounts = await Promise.all(
      (jobs || []).map(async (job: { id: string; job_type: string; status: string; original_filename: string | null; row_count: number | null; processed_count: number | null; created_at: string; updated_at: string }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count } = await (supabase as any)
          .from("categorized_transactions")
          .select("*", { count: "exact", head: true })
          .eq("job_id", job.id);

        return {
          ...job,
          transaction_count: count || 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      jobs: jobsWithCounts,
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}


