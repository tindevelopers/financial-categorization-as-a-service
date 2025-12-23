import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import {
  validateFile,
  uploadToSupabase,
  calculateFileHash,
  ALLOWED_MIME_TYPES,
} from "@/lib/storage/supabase-storage";

export const maxDuration = 60; // 60 seconds timeout for large files

interface UploadResponse {
  success: boolean;
  documentId?: string;
  message?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get tenant_id for the user
    type UserData = {
      tenant_id: string | null;
    };
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const tenantId = (userData as UserData | null)?.tenant_id || null;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const entityId = formData.get("entityId") as string | null;
    const fileType = (formData.get("fileType") as string) || "other";
    const description = formData.get("description") as string | null;
    const documentDate = formData.get("documentDate") as string | null;
    const vendorName = formData.get("vendorName") as string | null;
    const category = formData.get("category") as string | null;
    const tags = formData.get("tags") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type enum
    const validFileTypes = ["bank_statement", "receipt", "invoice", "tax_document", "other"];
    if (!validFileTypes.includes(fileType)) {
      return NextResponse.json(
        { success: false, error: `Invalid file type. Must be one of: ${validFileTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate file
    const validation = validateFile(file, fileType);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Verify entity exists and belongs to user/tenant (if provided)
    if (entityId) {
      const { data: entity, error: entityError } = await supabase
        .from("entities")
        .select("id")
        .eq("id", entityId)
        .single();

      if (entityError || !entity) {
        return NextResponse.json(
          { success: false, error: "Entity not found or access denied" },
          { status: 404 }
        );
      }
    }

    // Calculate file hash for deduplication
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileHash = calculateFileHash(fileBuffer);

    // Check for duplicate (same hash for same user)
    type ExistingDocument = {
      id: string;
      original_filename: string | null;
    };
    const { data: existingDoc } = await supabase
      .from("financial_documents")
      .select("id, original_filename")
      .eq("user_id", user.id)
      .eq("file_hash", fileHash)
      .eq("is_deleted", false)
      .single();

    if (existingDoc) {
      const doc = existingDoc as ExistingDocument;
      return NextResponse.json(
        { 
          success: false, 
          error: `Duplicate file detected. This file was already uploaded as "${doc.original_filename || "unknown"}"`,
          documentId: doc.id,
        },
        { status: 409 }
      );
    }

    // Upload to Supabase Storage
    const uploadResult = await uploadToSupabase(supabase, file, user.id, entityId);

    if (!uploadResult.success) {
      return NextResponse.json(
        { success: false, error: uploadResult.error || "Upload failed" },
        { status: 500 }
      );
    }

    // Parse tags if provided
    let parsedTags: string[] = [];
    if (tags) {
      try {
        parsedTags = JSON.parse(tags);
      } catch {
        // If not JSON, split by comma
        parsedTags = tags.split(",").map(t => t.trim()).filter(Boolean);
      }
    }

    // Create document record
    const { data: document, error: insertError } = await (supabase
      .from("financial_documents") as any)
      .insert({
        entity_id: entityId || null,
        tenant_id: tenantId,
        user_id: user.id,
        original_filename: file.name,
        file_type: fileType,
        mime_type: file.type,
        file_size_bytes: file.size,
        file_hash: fileHash,
        storage_tier: "hot",
        supabase_path: uploadResult.path,
        ocr_status: "pending",
        document_date: documentDate || null,
        vendor_name: vendorName || null,
        description: description || null,
        category: category || null,
        tags: parsedTags,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Document insert error:", insertError);
      return NextResponse.json(
        { success: false, error: "Failed to create document record" },
        { status: 500 }
      );
    }

    // Trigger OCR processing asynchronously
    if (process.env.NEXT_PUBLIC_APP_URL) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/documents/process-ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id }),
      }).catch(err => console.error('OCR trigger error:', err));
    }

    return NextResponse.json({
      success: true,
      documentId: document.id,
      message: "Document uploaded successfully. OCR processing will begin shortly.",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET: List allowed file types and size limits
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    allowedMimeTypes: ALLOWED_MIME_TYPES,
    maxFileSizeBytes: 50 * 1024 * 1024, // 50MB
    maxFileSizeMB: 50,
    fileTypes: ["bank_statement", "receipt", "invoice", "tax_document", "other"],
  });
}

