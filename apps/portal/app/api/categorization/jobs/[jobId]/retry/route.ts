import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";

/**
 * POST /api/categorization/jobs/[jobId]/retry
 * Retry processing a failed job
 */
export async function POST(
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

    // Get job details - verify it belongs to user and is in failed state
    const { data: job, error: jobError } = await supabase
      .from("categorization_jobs")
      .select("id, status, user_id, file_url, original_filename")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    if (job.status !== "failed") {
      return NextResponse.json(
        { error: `Cannot retry job with status '${job.status}'. Only failed jobs can be retried.` },
        { status: 400 }
      );
    }

    // Verify the file still exists
    if (job.file_url) {
      const fileName = job.file_url.split("/").pop() || "";
      const filePath = `${user.id}/${fileName.split("-").slice(1).join("-")}`;
      
      const { data: fileExists, error: fileError } = await supabase.storage
        .from("categorization-uploads")
        .list(user.id, {
          limit: 1,
          search: fileName.split("-").slice(1).join("-"),
        });

      if (fileError || !fileExists || fileExists.length === 0) {
        return NextResponse.json(
          { error: "Original file not found. Please upload the file again." },
          { status: 404 }
        );
      }
    }

    // Delete existing transactions for this job (if any partial processing occurred)
    try {
      const adminClient = createAdminClient();
      await adminClient
        .from("categorized_transactions")
        .delete()
        .eq("job_id", jobId);
    } catch (deleteError) {
      // Continue even if delete fails
      console.error("Error cleaning up existing transactions:", deleteError);
    }

    // Reset job status to queued
    let adminClient;
    try {
      adminClient = createAdminClient();
    } catch {
      adminClient = supabase;
    }

    const { error: updateError } = await adminClient
      .from("categorization_jobs")
      .update({
        status: "queued",
        status_message: "Queued for retry processing...",
        error_code: null,
        error_message: null,
        processed_items: 0,
        failed_items: 0,
        started_at: null,
        completed_at: null,
      })
      .eq("id", jobId);

    if (updateError) {
      console.error("Error updating job status:", updateError);
      return NextResponse.json(
        { error: "Failed to reset job for retry" },
        { status: 500 }
      );
    }

    // Trigger background processing
    try {
      fetch(`${request.nextUrl.origin}/api/background/process-spreadsheet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("cookie") || "",
        },
        body: JSON.stringify({ jobId }),
      }).catch(err => {
        console.error("Failed to trigger background processing:", err);
      });
    } catch (triggerError) {
      console.error("Failed to trigger background processing:", triggerError);
      // Don't fail the request - the cron job will pick it up
    }

    return NextResponse.json({
      success: true,
      message: "Job queued for retry",
      jobId,
    });
  } catch (error: any) {
    console.error("Retry job error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

