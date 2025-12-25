import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { deleteFromSupabase } from "@/lib/storage/supabase-storage";
import { deleteFromGCS } from "@/lib/storage/gcs-archive";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from("categorization_jobs")
      .select("id, user_id, file_url, status")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Get associated financial_documents
    const { data: documents } = await supabase
      .from("financial_documents")
      .select("id, supabase_path, storage_tier, gcs_archive_path, matched_transaction_id")
      .eq("job_id", jobId);

    // Unmatch any reconciled transactions/documents
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        if (doc.matched_transaction_id) {
          // Unmatch transaction
          await supabase
            .from("categorized_transactions")
            .update({
              reconciliation_status: "unreconciled",
              matched_document_id: null,
            })
            .eq("id", doc.matched_transaction_id);

          // Unmatch document
          await supabase
            .from("financial_documents")
            .update({
              matched_transaction_id: null,
            })
            .eq("id", doc.id);
        }
      }
    }

    // Soft delete transactions (mark as deleted or actually delete)
    await supabase
      .from("categorized_transactions")
      .delete()
      .eq("job_id", jobId);

    // Soft delete financial_documents
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        // Delete from storage if in hot tier
        if (doc.storage_tier === "hot" && doc.supabase_path) {
          await deleteFromSupabase(supabase, doc.supabase_path);
        }

        // Delete from archive if archived
        if (doc.storage_tier === "archive" && doc.gcs_archive_path) {
          await deleteFromGCS(doc.gcs_archive_path);
        }

        // Soft delete document record
        await supabase
          .from("financial_documents")
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
          })
          .eq("id", doc.id);
      }
    }

    // Delete file from storage if job has file_url
    if (job.file_url) {
      try {
        const fileName = job.file_url.split("/").pop() || "";
        const filePath = `${user.id}/${fileName.split("-").slice(1).join("-")}`;
        await deleteFromSupabase(supabase, filePath);
      } catch (storageError) {
        console.error("Error deleting file from storage:", storageError);
        // Continue with deletion even if storage deletion fails
      }
    }

    // Soft delete categorization_job (or hard delete - your choice)
    // For now, we'll hard delete since transactions are also deleted
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

    return NextResponse.json({
      success: true,
      message: "Upload and associated data deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete job error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
