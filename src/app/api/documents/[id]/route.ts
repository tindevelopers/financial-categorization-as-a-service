import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import { getSignedUrl, deleteFromSupabase } from "@/lib/storage/supabase-storage";
import { restoreFromGCS, checkRestoreStatus } from "@/lib/storage/gcs-archive";

interface DocumentResponse {
  id: string;
  entity_id: string | null;
  tenant_id: string | null;
  original_filename: string;
  file_type: string;
  mime_type: string;
  file_size_bytes: number | null;
  storage_tier: string;
  document_date: string | null;
  vendor_name: string | null;
  total_amount: number | null;
  currency: string;
  ocr_status: string;
  ocr_confidence: number | null;
  extracted_text: string | null;
  extracted_data: Record<string, unknown> | null;
  description: string | null;
  tags: string[];
  category: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  downloadUrl?: string;
  archiveStatus?: {
    ready: boolean;
    isRestoring?: boolean;
    estimatedRestoreTime?: string;
  };
}

/**
 * GET: Get document details and download URL
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
      .select("*")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (fetchError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Type assertion for document
    const doc = document as Record<string, unknown> & {
      id: string;
      entity_id: string | null;
      tenant_id: string | null;
      original_filename: string;
      file_type: string;
      mime_type: string;
      file_size_bytes: number | null;
      storage_tier: string;
      document_date: string | null;
      vendor_name: string | null;
      total_amount: number | null;
      currency: string | null;
      ocr_status: string;
      ocr_confidence: number | null;
      extracted_text: string | null;
      extracted_data: Record<string, unknown> | null;
      description: string | null;
      tags: string[] | null;
      category: string | null;
      is_verified: boolean | null;
      created_at: string;
      updated_at: string;
      supabase_path?: string | null;
      gcs_archive_path?: string | null;
    };

    const response: DocumentResponse = {
      id: doc.id,
      entity_id: doc.entity_id,
      tenant_id: doc.tenant_id,
      original_filename: doc.original_filename,
      file_type: doc.file_type,
      mime_type: doc.mime_type,
      file_size_bytes: doc.file_size_bytes,
      storage_tier: doc.storage_tier,
      document_date: doc.document_date,
      vendor_name: doc.vendor_name,
      total_amount: doc.total_amount,
      currency: doc.currency || "USD",
      ocr_status: doc.ocr_status,
      ocr_confidence: doc.ocr_confidence,
      extracted_text: doc.extracted_text,
      extracted_data: doc.extracted_data,
      description: doc.description,
      tags: doc.tags || [],
      category: doc.category,
      is_verified: doc.is_verified || false,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
    };

    // Get download URL based on storage tier
    if (doc.storage_tier === "hot" && doc.supabase_path) {
      const urlResult = await getSignedUrl(supabase, doc.supabase_path, 3600);
      if (urlResult.success) {
        response.downloadUrl = urlResult.url;
      }
    } else if (doc.storage_tier === "archive" && doc.gcs_archive_path) {
      // Check archive restore status
      const status = await checkRestoreStatus(doc.gcs_archive_path);
      response.archiveStatus = {
        ready: status.ready,
        isRestoring: !status.ready,
        estimatedRestoreTime: status.ready
          ? undefined
          : "Archive files can take 12-24 hours to restore",
      };
    }

    return NextResponse.json({ document: response });
  } catch (error) {
    console.error("Document fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Update document metadata
 */
export async function PATCH(
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

    // Check document exists and user has access
    const { data: existing, error: fetchError } = await supabase
      .from("financial_documents")
      .select("id")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Build update object with allowed fields
    const updates: Record<string, unknown> = {};

    if (body.description !== undefined) {
      updates.description = body.description;
    }
    if (body.category !== undefined) {
      updates.category = body.category;
    }
    if (body.tags !== undefined && Array.isArray(body.tags)) {
      updates.tags = body.tags;
    }
    if (body.document_date !== undefined) {
      updates.document_date = body.document_date;
    }
    if (body.vendor_name !== undefined) {
      updates.vendor_name = body.vendor_name;
    }
    if (body.total_amount !== undefined) {
      updates.total_amount = body.total_amount;
    }
    if (body.entity_id !== undefined) {
      // Verify entity exists and user has access
      if (body.entity_id) {
        const { error: entityError } = await supabase
          .from("entities")
          .select("id")
          .eq("id", body.entity_id)
          .single();

        if (entityError) {
          return NextResponse.json(
            { error: "Entity not found or access denied" },
            { status: 400 }
          );
        }
      }
      updates.entity_id = body.entity_id;
    }
    if (body.is_verified !== undefined) {
      updates.is_verified = body.is_verified;
    }
    if (body.file_type !== undefined) {
      const validTypes = ["bank_statement", "receipt", "invoice", "tax_document", "other"];
      if (!validTypes.includes(body.file_type)) {
        return NextResponse.json(
          { error: `Invalid file type. Must be one of: ${validTypes.join(", ")}` },
          { status: 400 }
        );
      }
      updates.file_type = body.file_type;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update document
    const { data: document, error: updateError } = await supabase
      .from("financial_documents")
      .update(updates as never)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Document update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update document" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error) {
    console.error("Document update error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Soft delete a document
 */
export async function DELETE(
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

    // Check document exists
    const { data: existing, error: fetchError } = await supabase
      .from("financial_documents")
      .select("id, supabase_path, storage_tier")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Soft delete the document record
    const { error: deleteError } = await supabase
      .from("financial_documents")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (deleteError) {
      console.error("Document delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      );
    }

    // Optionally delete from storage (or let a cleanup job handle it)
    if (existing.storage_tier === "hot" && existing.supabase_path) {
      await deleteFromSupabase(supabase, existing.supabase_path);
    }

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Document delete error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

