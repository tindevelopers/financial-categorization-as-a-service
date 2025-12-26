import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";
import { processSpreadsheetFile } from "@/lib/categorization/process-spreadsheet";

/**
 * Cron job to process stuck queued jobs
 * Runs every 5 minutes via Vercel Cron
 * 
 * Picks up jobs that are stuck in 'queued' status for more than 5 minutes
 * (e.g., if background function failed or wasn't triggered)
 */
export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Find jobs stuck in 'queued' status for more than 5 minutes
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    const { data: stuckJobs, error: jobsError } = await adminClient
      .from("categorization_jobs")
      .select("id, user_id, job_type, created_at")
      .eq("status", "queued")
      .eq("processing_mode", "async")
      .lt("created_at", fiveMinutesAgo.toISOString())
      .limit(50); // Process max 50 jobs per run

    if (jobsError) {
      console.error("Error fetching stuck jobs:", jobsError);
      return NextResponse.json(
        { error: "Failed to fetch stuck jobs" },
        { status: 500 }
      );
    }

    if (!stuckJobs || stuckJobs.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No stuck jobs found",
      });
    }

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each stuck job directly (using admin client)
    for (const job of stuckJobs) {
      try {
        // Update status to processing
        await adminClient
          .from("categorization_jobs")
          .update({
            status: "processing",
            started_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        // Get job details to find file path
        const { data: jobDetails } = await adminClient
          .from("categorization_jobs")
          .select("file_url")
          .eq("id", job.id)
          .single();

        if (!jobDetails) {
          results.failed++;
          results.errors.push(`Job ${job.id}: Job details not found`);
          continue;
        }

        // Download file from Supabase Storage
        const fileName = jobDetails.file_url?.split("/").pop() || "";
        const filePath = `${job.user_id}/${fileName.split("-").slice(1).join("-")}`;

        const { data: fileData, error: downloadError } = await adminClient.storage
          .from("categorization-uploads")
          .download(filePath);

        if (downloadError || !fileData) {
          await adminClient
            .from("categorization_jobs")
            .update({
              status: "failed",
              error_message: "Failed to download file",
            })
            .eq("id", job.id);
          results.failed++;
          results.errors.push(`Job ${job.id}: Failed to download file`);
          continue;
        }

        // Process spreadsheet
        const arrayBuffer = await fileData.arrayBuffer();
        const processResult = await processSpreadsheetFile(
          arrayBuffer,
          job.id,
          job.user_id,
          adminClient
        );

        if (!processResult.success) {
          await adminClient
            .from("categorization_jobs")
            .update({
              status: "failed",
              error_message: processResult.error || "Processing failed",
            })
            .eq("id", job.id);
          results.failed++;
          results.errors.push(`Job ${job.id}: ${processResult.error || "Processing failed"}`);
          continue;
        }

        // Update job status to reviewing
        await adminClient
          .from("categorization_jobs")
          .update({
            status: "reviewing",
            processed_items: processResult.transactionCount || 0,
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        results.processed++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Job ${job.id}: ${error.message || "Unknown error"}`);
        console.error(`Failed to process stuck job ${job.id}:`, error);

        // Try to update job status to failed
        try {
          await adminClient
            .from("categorization_jobs")
            .update({
              status: "failed",
              error_message: error.message || "Processing error",
            })
            .eq("id", job.id);
        } catch (updateError) {
          console.error(`Failed to update job ${job.id} status:`, updateError);
        }
      }
    }

    console.log(`Cron job processed stuck jobs:`, {
      total: stuckJobs.length,
      processed: results.processed,
      failed: results.failed,
    });

    return NextResponse.json({
      success: true,
      total_found: stuckJobs.length,
      processed: results.processed,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors.slice(0, 10) : undefined,
    });
  } catch (error: any) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// Also support POST for manual trigger
export async function POST(request: NextRequest) {
  return GET(request);
}

