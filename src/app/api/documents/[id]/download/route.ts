import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import { getSignedUrl } from "@/lib/storage/supabase-storage";
import { restoreFromGCS, checkRestoreStatus } from "@/lib/storage/gcs-archive";

/**
 * GET: Get download URL for a document
 * Handles both hot storage (immediate) and archive (may require restore)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch document
    const { data: document, error: fetchError } = await supabase
      .from("financial_documents")
      .select("id, storage_tier, supabase_path, gcs_archive_path, original_filename, mime_type")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (fetchError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Hot storage - return signed URL
    if (document.storage_tier === "hot" && document.supabase_path) {
      const urlResult = await getSignedUrl(supabase, document.supabase_path, 3600);

      if (!urlResult.success) {
        return NextResponse.json(
          { error: urlResult.error || "Failed to generate download URL" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        downloadUrl: urlResult.url,
        filename: document.original_filename,
        mimeType: document.mime_type,
        storageTier: "hot",
        expiresIn: 3600,
      });
    }

    // Archive storage - check if restore is needed
    if (document.storage_tier === "archive" && document.gcs_archive_path) {
      const status = await checkRestoreStatus(document.gcs_archive_path);

      if (!status.ready) {
        // Need to initiate restore
        return NextResponse.json({
          success: false,
          needsRestore: true,
          storageTier: "archive",
          message: "This document is in archive storage and needs to be restored before download.",
          estimatedRestoreTime: "Archive class files can take 12-24 hours to restore.",
          restoreEndpoint: `/api/documents/${id}/restore`,
        }, { status: 202 });
      }

      // File is restored and ready
      const restoreResult = await restoreFromGCS(document.gcs_archive_path);

      if (!restoreResult.success) {
        return NextResponse.json(
          { error: restoreResult.error || "Failed to retrieve archived document" },
          { status: 500 }
        );
      }

      // For GCS, we need to generate a signed URL or serve the file directly
      // This is a simplified implementation
      return NextResponse.json({
        success: true,
        storageTier: "archive",
        filename: document.original_filename,
        mimeType: document.mime_type,
        message: "Document is ready for download. Use the restore endpoint for the actual file.",
        restoreEndpoint: `/api/documents/${id}/restore`,
      });
    }

    // Pending archive - file might still be in Supabase
    if (document.storage_tier === "pending_archive" && document.supabase_path) {
      const urlResult = await getSignedUrl(supabase, document.supabase_path, 3600);

      if (urlResult.success) {
        return NextResponse.json({
          success: true,
          downloadUrl: urlResult.url,
          filename: document.original_filename,
          mimeType: document.mime_type,
          storageTier: "pending_archive",
          expiresIn: 3600,
        });
      }
    }

    return NextResponse.json(
      { error: "Document file not available" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

