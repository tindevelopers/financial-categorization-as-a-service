import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";

/**
 * DELETE /api/categorization/jobs/cleanup
 * Bulk delete jobs based on type
 * 
 * Query params:
 *   - type: "failed" | "duplicates" | "all_except_latest" | "empty"
 *   - dryRun: "true" to preview what would be deleted without actually deleting
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "failed";
    const dryRun = searchParams.get("dryRun") === "true";

    const adminClient = createAdminClient();

    let jobsToDelete: { id: string; original_filename: string | null; status: string; created_at: string }[] = [];

    switch (type) {
      case "failed": {
        // Delete all failed jobs
        const { data: failedJobs, error } = await adminClient
          .from("categorization_jobs")
          .select("id, original_filename, status, created_at")
          .eq("user_id", user.id)
          .eq("status", "failed");

        if (error) {
          console.error("Error fetching failed jobs:", error);
          return NextResponse.json(
            { error: "Failed to fetch jobs", details: error.message },
            { status: 500 }
          );
        }
        jobsToDelete = failedJobs || [];
        break;
      }

      case "duplicates": {
        // Find jobs with the same file_hash, keep the latest one
        const { data: allJobs, error } = await adminClient
          .from("categorization_jobs")
          .select("id, original_filename, status, created_at, file_hash")
          .eq("user_id", user.id)
          .not("file_hash", "is", null)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching jobs:", error);
          return NextResponse.json(
            { error: "Failed to fetch jobs", details: error.message },
            { status: 500 }
          );
        }

        // Group by file_hash and mark all but the latest as duplicates
        const hashGroups = new Map<string, typeof allJobs>();
        for (const job of allJobs || []) {
          if (job.file_hash) {
            if (!hashGroups.has(job.file_hash)) {
              hashGroups.set(job.file_hash, []);
            }
            hashGroups.get(job.file_hash)!.push(job);
          }
        }

        // For each group with more than one job, mark all but the first (latest) as duplicates
        for (const jobs of hashGroups.values()) {
          if (jobs.length > 1) {
            // Skip the first one (latest), add the rest to delete list
            for (let i = 1; i < jobs.length; i++) {
              jobsToDelete.push({
                id: jobs[i].id,
                original_filename: jobs[i].original_filename,
                status: jobs[i].status,
                created_at: jobs[i].created_at,
              });
            }
          }
        }
        break;
      }

      case "all_except_latest": {
        // Delete all jobs except the most recent one per unique filename
        const { data: allJobs, error } = await adminClient
          .from("categorization_jobs")
          .select("id, original_filename, status, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching jobs:", error);
          return NextResponse.json(
            { error: "Failed to fetch jobs", details: error.message },
            { status: 500 }
          );
        }

        // Group by original_filename and mark all but the latest as duplicates
        const filenameGroups = new Map<string, typeof allJobs>();
        for (const job of allJobs || []) {
          const filename = job.original_filename || "unknown";
          if (!filenameGroups.has(filename)) {
            filenameGroups.set(filename, []);
          }
          filenameGroups.get(filename)!.push(job);
        }

        // For each group with more than one job, mark all but the first (latest) as duplicates
        for (const jobs of filenameGroups.values()) {
          if (jobs.length > 1) {
            for (let i = 1; i < jobs.length; i++) {
              jobsToDelete.push({
                id: jobs[i].id,
                original_filename: jobs[i].original_filename,
                status: jobs[i].status,
                created_at: jobs[i].created_at,
              });
            }
          }
        }
        break;
      }

      case "empty": {
        // Delete jobs with no transactions
        const { data: allJobs, error } = await adminClient
          .from("categorization_jobs")
          .select(`
            id, 
            original_filename, 
            status, 
            created_at,
            categorized_transactions(count)
          `)
          .eq("user_id", user.id);

        if (error) {
          console.error("Error fetching jobs:", error);
          return NextResponse.json(
            { error: "Failed to fetch jobs", details: error.message },
            { status: 500 }
          );
        }

        // Filter to jobs with no transactions
        for (const job of allJobs || []) {
          const txCount = (job as any).categorized_transactions?.[0]?.count || 0;
          if (txCount === 0) {
            jobsToDelete.push({
              id: job.id,
              original_filename: job.original_filename,
              status: job.status,
              created_at: job.created_at,
            });
          }
        }
        break;
      }

      default:
        return NextResponse.json(
          { error: "Invalid cleanup type. Use: failed, duplicates, all_except_latest, or empty" },
          { status: 400 }
        );
    }

    // If dry run, just return the list of jobs that would be deleted
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        type,
        count: jobsToDelete.length,
        jobs: jobsToDelete.map(j => ({
          id: j.id,
          filename: j.original_filename,
          status: j.status,
          createdAt: j.created_at,
        })),
        message: `Would delete ${jobsToDelete.length} job(s)`,
      });
    }

    // Actually delete the jobs
    if (jobsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        message: "No jobs to delete",
      });
    }

    const jobIds = jobsToDelete.map(j => j.id);

    // First, delete associated transactions
    const { error: txDeleteError } = await adminClient
      .from("categorized_transactions")
      .delete()
      .in("job_id", jobIds);

    if (txDeleteError) {
      console.error("Error deleting transactions:", txDeleteError);
      // Continue anyway - the job deletion will cascade
    }

    // Delete associated financial_documents
    const { error: docDeleteError } = await adminClient
      .from("financial_documents")
      .delete()
      .in("job_id", jobIds);

    if (docDeleteError) {
      console.error("Error deleting documents:", docDeleteError);
      // Continue anyway
    }

    // Delete the jobs
    const { error: jobDeleteError } = await adminClient
      .from("categorization_jobs")
      .delete()
      .in("id", jobIds);

    if (jobDeleteError) {
      console.error("Error deleting jobs:", jobDeleteError);
      return NextResponse.json(
        { error: "Failed to delete jobs", details: jobDeleteError.message },
        { status: 500 }
      );
    }

    // Also try to delete files from storage (best effort)
    for (const job of jobsToDelete) {
      if (job.original_filename) {
        const storagePath = `${user.id}/${job.original_filename}`;
        await supabase.storage
          .from("categorization-uploads")
          .remove([storagePath])
          .catch(() => {
            // Ignore storage deletion errors - file may not exist or path may differ
          });
      }
    }

    return NextResponse.json({
      success: true,
      deleted: jobsToDelete.length,
      deletedJobs: jobsToDelete.map(j => ({
        id: j.id,
        filename: j.original_filename,
        status: j.status,
      })),
      message: `Successfully deleted ${jobsToDelete.length} job(s)`,
    });
  } catch (error: any) {
    console.error("Cleanup error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/categorization/jobs/cleanup
 * Preview what would be deleted
 */
export async function GET(request: NextRequest) {
  // Redirect to DELETE with dryRun=true
  const url = new URL(request.url);
  url.searchParams.set("dryRun", "true");
  
  const newRequest = new NextRequest(url, {
    method: "DELETE",
    headers: request.headers,
  });
  
  return DELETE(newRequest);
}

