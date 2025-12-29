import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "apps/portal/app/api/documents/[id]/download/route.ts:entry",
        message: "download route called",
        data: { documentId: id, userId: `${user.id.slice(0, 8)}...` },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "H2",
      }),
    }).catch(() => {});
    // #endregion

    const { data: doc, error: docError } = await supabase
      .from("financial_documents")
      .select("id, user_id, storage_tier, supabase_path, gcs_archive_path, original_filename, mime_type, is_deleted")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (docError || !doc || doc.is_deleted) {
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "apps/portal/app/api/documents/[id]/download/route.ts:notFound",
          message: "document not found or deleted",
          data: { documentId: id, hasDoc: Boolean(doc), error: docError?.message },
          timestamp: Date.now(),
          sessionId: "debug-session",
          runId: "run1",
          hypothesisId: "H2",
        }),
      }).catch(() => {});
      // #endregion

      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Hot/pending -> signed url from categorization-uploads bucket
    if ((doc.storage_tier === "hot" || doc.storage_tier === "pending_archive") && doc.supabase_path) {
      const { data: signed, error: signedError } = await supabase.storage
        .from("categorization-uploads")
        .createSignedUrl(doc.supabase_path, 60 * 60);

      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "apps/portal/app/api/documents/[id]/download/route.ts:signedUrl",
          message: "signed url attempt",
          data: {
            documentId: id,
            tier: doc.storage_tier,
            hasPath: Boolean(doc.supabase_path),
            ok: Boolean(signed?.signedUrl) && !signedError,
            error: signedError?.message,
          },
          timestamp: Date.now(),
          sessionId: "debug-session",
          runId: "run1",
          hypothesisId: "H3",
        }),
      }).catch(() => {});
      // #endregion

      if (signedError || !signed?.signedUrl) {
        return NextResponse.json(
          { error: signedError?.message || "Failed to generate download URL" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        downloadUrl: signed.signedUrl,
        filename: doc.original_filename,
        mimeType: doc.mime_type,
        storageTier: doc.storage_tier,
        expiresIn: 3600,
      });
    }

    if (doc.storage_tier === "archive" && doc.gcs_archive_path) {
      return NextResponse.json(
        {
          success: false,
          needsRestore: true,
          storageTier: "archive",
          message: "This document is in archive storage and needs restore before download.",
        },
        { status: 202 }
      );
    }

    return NextResponse.json({ error: "Document file not available" }, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}


