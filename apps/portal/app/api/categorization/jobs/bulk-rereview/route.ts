import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { processSpreadsheetFile } from "@/lib/categorization/process-spreadsheet";

/**
 * POST /api/categorization/jobs/bulk-rereview
 * Re-process multiple categorization jobs
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { jobIds } = body;

    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return NextResponse.json(
        { error: "jobIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Verify all jobs exist and belong to user
    const { data: jobs, error: jobsError } = await supabase
      .from("categorization_jobs")
      .select("id, user_id, job_type, file_url, status")
      .in("id", jobIds)
      .eq("user_id", user.id);

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      return NextResponse.json(
        { error: "Failed to verify jobs" },
        { status: 500 }
      );
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json(
        { error: "No valid jobs found" },
        { status: 404 }
      );
    }

    const validJobIds = jobs.map(j => j.id);
    let processedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each job
    for (const job of jobs) {
      try {
        // Only process spreadsheet jobs for now
        if (job.job_type !== 'spreadsheet') {
          errors.push(`Job ${job.id}: Only spreadsheet jobs can be re-reviewed`);
          errorCount++;
          continue;
        }

        // Check if file exists
        if (!job.file_url) {
          errors.push(`Job ${job.id}: No file URL found`);
          errorCount++;
          continue;
        }

        // Update job status to processing
        await supabase
          .from("categorization_jobs")
          .update({ 
            status: "processing",
            started_at: new Date().toISOString(),
            processed_items: 0,
            failed_items: 0,
          })
          .eq("id", job.id);

        // Download file from Supabase Storage
        const fileName = job.file_url.split("/").pop() || "";
        const filePath = `${user.id}/${fileName.split("-").slice(1).join("-")}`;
        
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("categorization-uploads")
          .download(filePath);

        if (downloadError || !fileData) {
          await supabase
            .from("categorization_jobs")
            .update({ 
              status: "failed",
              error_message: "Failed to download file",
            })
            .eq("id", job.id);
          
          errors.push(`Job ${job.id}: Failed to download file`);
          errorCount++;
          continue;
        }

        // Delete existing transactions for this job before reprocessing
        await supabase
          .from("categorized_transactions")
          .delete()
          .eq("job_id", job.id);

        // Process spreadsheet
        const arrayBuffer = await fileData.arrayBuffer();
        const result = await processSpreadsheetFile(arrayBuffer, job.id, user.id, supabase);

        if (!result.success) {
          await supabase
            .from("categorization_jobs")
            .update({
              status: "failed",
              error_message: result.error || "Processing failed",
            })
            .eq("id", job.id);

          errors.push(`Job ${job.id}: ${result.error || "Processing failed"}`);
          errorCount++;
          continue;
        }

        // Update job status to reviewing
        await supabase
          .from("categorization_jobs")
          .update({
            status: "reviewing",
            processed_items: result.transactionCount || 0,
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        processedCount++;
      } catch (error: any) {
        console.error(`Error processing job ${job.id}:`, error);
        errors.push(`Job ${job.id}: ${error.message || "Unknown error"}`);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Re-reviewed ${processedCount} job(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      processedCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Bulk re-review error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

