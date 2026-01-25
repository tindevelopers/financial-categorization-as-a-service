import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

/**
 * GET /api/documents/[id]
 * Get a specific document with its details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const documentId = params.id;

    // Fetch document
    const { data: document, error: docError } = await supabase
      .from("financial_documents")
      .select("*")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Get download URL if document is in storage
    let downloadUrl = null;
    if (document.supabase_path) {
      const { data: urlData } = await supabase.storage
        .from("categorization-uploads")
        .createSignedUrl(document.supabase_path, 3600); // 1 hour expiry

      downloadUrl = urlData?.signedUrl || null;
    }

    // Check if document is archived and needs restoration
    let archiveStatus = null;
    if (document.storage_tier === 'archive') {
      archiveStatus = {
        isArchived: true,
        isRestoring: document.archive_restore_status === 'in_progress',
        canRestore: document.archive_restore_status !== 'in_progress',
      };
    }

    return NextResponse.json({
      document: {
        ...document,
        downloadUrl,
        archiveStatus,
      },
    });

  } catch (error: any) {
    console.error("Error in /api/documents/[id]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/documents/[id]
 * Update document data (for manual corrections after OCR review)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const documentId = params.id;
    const updates = await request.json();

    // Validate document belongs to user
    const { data: existingDoc, error: checkError } = await supabase
      .from("financial_documents")
      .select("id")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .single();

    if (checkError || !existingDoc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Update allowed fields
    const allowedFields = {
      vendor_name: updates.vendor_name,
      document_date: updates.document_date,
      document_number: updates.document_number,
      order_number: updates.order_number,
      total_amount: updates.total_amount,
      subtotal_amount: updates.subtotal_amount,
      tax_amount: updates.tax_amount,
      tax_rate: updates.tax_rate,
      fee_amount: updates.fee_amount,
      line_items: updates.line_items,
      currency: updates.currency,
    };

    // Remove undefined fields
    Object.keys(allowedFields).forEach(key => {
      if (allowedFields[key as keyof typeof allowedFields] === undefined) {
        delete allowedFields[key as keyof typeof allowedFields];
      }
    });

    // Update document
    const { data: updatedDoc, error: updateError } = await supabase
      .from("financial_documents")
      .update(allowedFields)
      .eq("id", documentId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating document:", updateError);
      return NextResponse.json(
        { error: "Failed to update document" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      document: updatedDoc,
    });

  } catch (error: any) {
    console.error("Error in PATCH /api/documents/[id]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/[id]
 * Delete a document
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const documentId = params.id;

    // Delete document (will cascade to related records)
    const { error: deleteError } = await supabase
      .from("financial_documents")
      .delete()
      .eq("id", documentId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Error deleting document:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
    });

  } catch (error: any) {
    console.error("Error in DELETE /api/documents/[id]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
