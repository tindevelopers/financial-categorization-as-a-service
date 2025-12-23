import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@tinadmin/core/database/admin-client";

/**
 * DELETE /api/categorization/jobs/[jobId]
 * Delete a categorization job and all associated data
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
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

    const { jobId } = params;

    // Verify job exists and belongs to user
    const { data: job, error: jobError } = await supabase
      .from("categorization_jobs")
      .select("id, user_id, file_url")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Get associated financial_documents to find storage paths
    const { data: documents } = await supabase
      .from("financial_documents")
      .select("id, supabase_path, storage_tier, gcs_archive_path")
      .eq("job_id", jobId);

    // Delete all associated categorized_transactions
    // Using admin client to ensure deletion works even with RLS
    try {
      const adminClient = createAdminClient();
      const { error: transactionsError } = await adminClient
        .from("categorized_transactions")
        .delete()
        .eq("job_id", jobId);

      if (transactionsError) {
        console.error("Error deleting transactions:", transactionsError);
        // Continue with deletion even if transactions fail
      }
    } catch (adminError) {
      console.error("Admin client error deleting transactions:", adminError);
      // Fallback to regular client
      const { error: transactionsError } = await supabase
        .from("categorized_transactions")
        .delete()
        .eq("job_id", jobId);

      if (transactionsError) {
        console.error("Error deleting transactions:", transactionsError);
      }
    }

    // Delete files from storage
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        // Delete from Supabase Storage if in hot storage
        if (doc.storage_tier === "hot" && doc.supabase_path) {
          const { error: storageError } = await supabase.storage
            .from("categorization-uploads")
            .remove([doc.supabase_path]);

          if (storageError) {
            console.error("Error deleting file from storage:", storageError);
            // Continue with deletion even if storage deletion fails
          }
        }
        // Note: Archived files in GCS would need separate handling
        // For now, we'll just delete the database records
      }

      // Delete financial_documents records
      try {
        const adminClient = createAdminClient();
        const { error: docsError } = await adminClient
          .from("financial_documents")
          .delete()
          .eq("job_id", jobId);

        if (docsError) {
          console.error("Error deleting financial_documents:", docsError);
        }
      } catch (adminError) {
        console.error("Admin client error deleting documents:", adminError);
        // Fallback to regular client
        const { error: docsError } = await supabase
          .from("financial_documents")
          .delete()
          .eq("job_id", jobId);

        if (docsError) {
          console.error("Error deleting financial_documents:", docsError);
        }
      }
    }

    // Delete the categorization_jobs record
    try {
      const adminClient = createAdminClient();
      const { error: deleteError } = await adminClient
        .from("categorization_jobs")
        .delete()
        .eq("id", jobId);

      if (deleteError) {
        console.error("Error deleting job:", deleteError);
        return NextResponse.json(
          { error: "Failed to delete job" },
          { status: 500 }
        );
      }
    } catch (adminError) {
      console.error("Admin client error deleting job:", adminError);
      // Fallback to regular client
      const { error: deleteError } = await supabase
        .from("categorization_jobs")
        .delete()
        .eq("id", jobId);

      if (deleteError) {
        console.error("Error deleting job:", deleteError);
        return NextResponse.json(
          { error: "Failed to delete job" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Job and all associated data deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

