import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";

/**
 * POST /api/categorization/jobs/reset-storage
 * Delete ALL categorization jobs and associated data for the current user
 * WARNING: This is a destructive operation that cannot be undone
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

    // Get all jobs for the user
    const { data: jobs, error: jobsError } = await supabase
      .from("categorization_jobs")
      .select("id")
      .eq("user_id", user.id);

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      return NextResponse.json(
        { error: "Failed to fetch jobs" },
        { status: 500 }
      );
    }

    const jobIds = jobs?.map(j => j.id) || [];

    if (jobIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No jobs found to delete",
        deletedCount: 0,
      });
    }

    // Get all associated financial_documents to find storage paths
    const { data: documents } = await supabase
      .from("financial_documents")
      .select("id, supabase_path, storage_tier, gcs_archive_path, job_id")
      .in("job_id", jobIds);

    const adminClient = createAdminClient();
    let deletedCount = 0;
    let storageDeletedCount = 0;

    // Delete all associated categorized_transactions
    const { error: transactionsError } = await adminClient
      .from("categorized_transactions")
      .delete()
      .in("job_id", jobIds);

    if (transactionsError) {
      console.error("Error deleting transactions:", transactionsError);
    }

    // Delete files from storage
    if (documents && documents.length > 0) {
      // Group documents by storage tier for efficient deletion
      const hotStoragePaths = documents
        .filter(d => d.storage_tier === "hot" && d.supabase_path)
        .map(d => d.supabase_path!);

      // Delete from Supabase Storage in batches
      if (hotStoragePaths.length > 0) {
        const batchSize = 100; // Supabase storage delete limit
        for (let i = 0; i < hotStoragePaths.length; i += batchSize) {
          const batch = hotStoragePaths.slice(i, i + batchSize);
          const { error: storageError } = await supabase.storage
            .from("categorization-uploads")
            .remove(batch);

          if (storageError) {
            console.error(`Error deleting batch from storage:`, storageError);
          } else {
            storageDeletedCount += batch.length;
          }
        }
      }

      // Note: Archived files in GCS would need separate handling
      // For now, we'll just delete the database records
    }

    // Delete all financial_documents records
    if (documents && documents.length > 0) {
      const documentIds = documents.map(d => d.id);
      const { error: docsError } = await adminClient
        .from("financial_documents")
        .delete()
        .in("id", documentIds);

      if (docsError) {
        console.error("Error deleting financial_documents:", docsError);
      }
    }

    // Delete all categorization_jobs records
    const { error: deleteError } = await adminClient
      .from("categorization_jobs")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Error deleting jobs:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete jobs" },
        { status: 500 }
      );
    }

    deletedCount = jobIds.length;

    return NextResponse.json({
      success: true,
      message: `Storage reset successfully. Deleted ${deletedCount} job(s) and ${storageDeletedCount} file(s) from storage.`,
      deletedCount,
      storageDeletedCount,
    });
  } catch (error: any) {
    console.error("Reset storage error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

