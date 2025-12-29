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
    const { data: doc, error: docError } = await supabase
      .from("financial_documents")
      .select("id, user_id, storage_tier, supabase_path, gcs_archive_path, original_filename, mime_type, is_deleted")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (docError || !doc || doc.is_deleted) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Hot/pending -> signed url from categorization-uploads bucket
    if ((doc.storage_tier === "hot" || doc.storage_tier === "pending_archive") && doc.supabase_path) {
      const { data: signed, error: signedError } = await supabase.storage
        .from("categorization-uploads")
        .createSignedUrl(doc.supabase_path, 60 * 60);
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


