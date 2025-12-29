import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { data, error } = await supabase
      .from("financial_documents")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, document: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    // Only allow invoice-related fields to be updated
    const allowed = [
      "vendor_name",
      "invoice_number",
      "po_number",
      "order_number",
      "document_date",
      "delivery_date",
      "paid_date",
      "subtotal_amount",
      "tax_amount",
      "fee_amount",
      "shipping_amount",
      "total_amount",
      "currency",
      "line_items",
      "payment_method",
      "notes",
      "ocr_needs_review",
      "ocr_field_confidence",
      "ocr_extraction_methods",
    ];

    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    // If nothing to update, return success
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true });
    }

    // Try update; if remote DB is missing a newer column, retry without it
    let pendingUpdates = { ...updates };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastError: any = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const { error } = await supabase
        .from("financial_documents")
        .update(pendingUpdates)
        .eq("id", id)
        .eq("user_id", user.id);

      if (!error) {
        return NextResponse.json({ success: true });
      }

      lastError = error;
      const errMsg = String(error.message || "");
      const match = errMsg.match(/financial_documents\.([a-zA-Z0-9_]+)/);
      const missingCol = match?.[1];
      if ((error as any)?.code === "42703" && missingCol && pendingUpdates[missingCol] !== undefined) {
        const next = { ...pendingUpdates };
        delete next[missingCol];
        pendingUpdates = next;
        continue;
      }

      break;
    }

    return NextResponse.json(
      { error: "Failed to update document", details: lastError?.message },
      { status: 500 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    // Soft delete so download route respects it (download route checks is_deleted)
    const { error } = await supabase
      .from("financial_documents")
      .update({ is_deleted: true })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete document", details: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, message: "Document deleted" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}


