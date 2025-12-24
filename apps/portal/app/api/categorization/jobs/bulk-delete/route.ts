import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@tinadmin/core/database/admin-client";

/**
 * POST /api/categorization/jobs/bulk-delete
 * Delete multiple categorization jobs and all associated data
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
      .select("id, user_id")
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

    // Get associated financial_documents to find storage paths
    const { data: documents } = await supabase
      .from("financial_documents")
      .select("id, supabase_path, storage_tier, gcs_archive_path, job_id")
      .in("job_id", validJobIds);

    const adminClient = createAdminClient();
    let deletedCount = 0;
    let errorCount = 0;

    // Delete each job and its associated data
    for (const jobId of validJobIds) {
      try {
        // Get documents for this specific job
        const jobDocuments = documents?.filter(d => d.job_id === jobId) || [];

        // Delete all associated categorized_transactions
        const { error: transactionsError } = await adminClient
          .from("categorized_transactions")
          .delete()
          .eq("job_id", jobId);

        if (transactionsError) {
          console.error(`Error deleting transactions for job ${jobId}:`, transactionsError);
        }

        // Delete files from storage
        for (const doc of jobDocuments) {
          // Delete from Supabase Storage if in hot storage
          if (doc.storage_tier === "hot" && doc.supabase_path) {
            const { error: storageError } = await supabase.storage
              .from("categorization-uploads")
              .remove([doc.supabase_path]);

            if (storageError) {
              console.error(`Error deleting file from storage for job ${jobId}:`, storageError);
            }
          }
          // Note: Archived files in GCS would need separate handling
        }

        // Delete financial_documents records
        if (jobDocuments.length > 0) {
          const { error: docsError } = await adminClient
            .from("financial_documents")
            .delete()
            .eq("job_id", jobId);

          if (docsError) {
            console.error(`Error deleting financial_documents for job ${jobId}:`, docsError);
          }
        }

        // Delete the categorization_jobs record
        const { error: deleteError } = await adminClient
          .from("categorization_jobs")
          .delete()
          .eq("id", jobId);

        if (deleteError) {
          console.error(`Error deleting job ${jobId}:`, deleteError);
          errorCount++;
        } else {
          deletedCount++;
        }
      } catch (error) {
        console.error(`Error processing job ${jobId}:`, error);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} job(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      deletedCount,
      errorCount,
    });
  } catch (error: any) {
    console.error("Bulk delete error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

