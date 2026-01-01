import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";
import { waitUntil } from "@vercel/functions";

export const maxDuration = 60;

type UploadResponse = {
  success: boolean;
  documentId?: string;
  error?: string;
  details?: string;
};

const BUCKET = "categorization-uploads";

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fileType = (formData.get("fileType") as string) || "other";
    const entityId = (formData.get("entityId") as string) || null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    // Minimal validation (keep portal permissive; server-side OCR will validate further)
    const allowedTypes = ["bank_statement", "receipt", "invoice", "tax_document", "other"];
    if (!allowedTypes.includes(fileType)) {
      return NextResponse.json(
        { success: false, error: `Invalid fileType. Must be one of: ${allowedTypes.join(", ")}` },
        { status: 400 }
      );
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "File too large (max 50MB)" }, { status: 400 });
    }

    // Get tenant_id for the user
    const { data: userRow } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const tenantId = (userRow as any)?.tenant_id || null;

    // Use a collision-resistant storage key
    const safeName = (file.name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${user.id}/${Date.now()}-${safeName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      return NextResponse.json(
        { success: false, error: "Upload failed", details: uploadError.message },
        { status: 500 }
      );
    }

    // Insert financial_documents record (admin client avoids any unexpected RLS issues)
    const admin = createAdminClient();
    const { data: doc, error: insertError } = await admin
      .from("financial_documents")
      .insert({
        user_id: user.id,
        tenant_id: tenantId,
        entity_id: entityId,
        original_filename: file.name,
        file_type: fileType,
        mime_type: file.type,
        file_size_bytes: file.size,
        storage_tier: "hot",
        supabase_path: storagePath,
        ocr_status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !doc?.id) {
      // Best-effort cleanup of storage object
      await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
      return NextResponse.json(
        { success: false, error: "Failed to create document record", details: insertError?.message },
        { status: 500 }
      );
    }

    // Trigger OCR asynchronously (uses Cookie header forwarding for auth)
    waitUntil(
      fetch(`${request.nextUrl.origin}/api/documents/${doc.id}/process-ocr`, {
        method: "POST",
        headers: {
          Cookie: request.headers.get("cookie") || "",
        },
      }).catch((err) => {
        console.error("OCR trigger error:", err);
      })
    );

    return NextResponse.json({ success: true, documentId: doc.id });
  } catch (error: any) {
    console.error("documents/upload error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}


