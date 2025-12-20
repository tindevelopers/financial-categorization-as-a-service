import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import { restoreFromGCS, checkRestoreStatus } from "@/lib/storage/gcs-archive";

/**
 * POST: Request restore of an archived document
 * Initiates restore from GCS Archive class to Standard class
 */
export async function POST(
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
      .select("id, storage_tier, gcs_archive_path, original_filename")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (fetchError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    if (document.storage_tier !== "archive") {
      return NextResponse.json(
        { error: "Document is not in archive storage" },
        { status: 400 }
      );
    }

    if (!document.gcs_archive_path) {
      return NextResponse.json(
        { error: "Archive path not found" },
        { status: 500 }
      );
    }

    // Check current status
    const status = await checkRestoreStatus(document.gcs_archive_path);

    if (status.ready) {
      return NextResponse.json({
        success: true,
        alreadyRestored: true,
        message: "Document is already restored and ready for download",
        downloadEndpoint: `/api/documents/${id}/download`,
      });
    }

    // Initiate restore
    const restoreResult = await restoreFromGCS(document.gcs_archive_path);

    if (!restoreResult.success) {
      return NextResponse.json(
        { error: restoreResult.error || "Failed to initiate restore" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      isRestoring: true,
      message: "Restore initiated. Archive class files typically take 12-24 hours to restore.",
      estimatedRestoreTime: restoreResult.estimatedRestoreTime,
      statusEndpoint: `/api/documents/${id}/restore`,
    }, { status: 202 });
  } catch (error) {
    console.error("Restore error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET: Check restore status
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
      .select("id, storage_tier, gcs_archive_path")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (fetchError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    if (document.storage_tier !== "archive") {
      return NextResponse.json({
        success: true,
        storageTier: document.storage_tier,
        message: "Document is not in archive storage",
        isArchived: false,
      });
    }

    if (!document.gcs_archive_path) {
      return NextResponse.json(
        { error: "Archive path not found" },
        { status: 500 }
      );
    }

    const status = await checkRestoreStatus(document.gcs_archive_path);

    return NextResponse.json({
      success: true,
      isArchived: true,
      isRestored: status.ready,
      storageClass: status.storageClass,
      downloadEndpoint: status.ready ? `/api/documents/${id}/download` : undefined,
      message: status.ready
        ? "Document is restored and ready for download"
        : "Document is being restored. This can take 12-24 hours for Archive class.",
    });
  } catch (error) {
    console.error("Restore status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

