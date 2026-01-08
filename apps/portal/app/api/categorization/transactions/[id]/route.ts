import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";
import { waitUntil } from "@vercel/functions";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { category, subcategory, supplier_id, user_notes } = await request.json();

    // Use admin client to bypass RLS on categorized_transactions (ownership is enforced below via job check)
    const admin = createAdminClient();

    // Fetch transaction job_id
    const { data: transaction, error: txError } = await admin
      .from("categorized_transactions")
      .select("job_id")
      .eq("id", id)
      .single();

    if (txError || !transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Verify job belongs to user
    const { data: job, error: jobError } = await supabase
      .from("categorization_jobs")
      .select("user_id")
      .eq("id", transaction.job_id)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Verify supplier belongs to user if supplier_id is provided
    if (supplier_id) {
      const { data: supplier, error: supplierError } = await supabase
        .from("suppliers")
        .select("id")
        .eq("id", supplier_id)
        .eq("user_id", user.id)
        .single();

      if (supplierError || !supplier) {
        return NextResponse.json(
          { error: "Supplier not found" },
          { status: 404 }
        );
      }
    }

    // Update transaction
    const updateData: any = {};
    if (category !== undefined) updateData.category = category;
    if (subcategory !== undefined) updateData.subcategory = subcategory;
    if (supplier_id !== undefined) updateData.supplier_id = supplier_id || null;
    if (user_notes !== undefined) updateData.user_notes = user_notes || null;
    
    // Mark as pending sync since it was updated
    updateData.sync_status = "pending";

    const { error: updateError } = await admin
      .from("categorized_transactions")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update transaction" },
        { status: 500 }
      );
    }

    // Trigger background sync if job has spreadsheet_id
    const { data: jobSyncInfo } = await supabase
      .from("categorization_jobs")
      .select("spreadsheet_id, bank_account_id")
      .eq("id", transaction.job_id)
      .single();

    if (jobSyncInfo && (jobSyncInfo.spreadsheet_id || jobSyncInfo.bank_account_id)) {
      // Trigger incremental sync in background (non-blocking)
      waitUntil(
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"}/api/categorization/jobs/${transaction.job_id}/sync-sheets?mode=incremental`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cookie": request.headers.get("cookie") || "",
          },
          body: JSON.stringify({
            transaction_ids: [id],
          }),
        }).catch((error) => {
          console.error("Background sync error:", error);
          // Don't fail the transaction update if sync fails
        })
      );
    }

    return NextResponse.json({
      success: true,
      message: "Transaction updated",
    });
  } catch (error: any) {
    console.error("Error:", error);
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
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify transaction belongs to user's job
    const { data: transaction, error: txError } = await supabase
      .from("categorized_transactions")
      .select("job_id")
      .eq("id", id)
      .single();
    if (txError || !transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Verify job belongs to user
    const { data: job, error: jobError } = await supabase
      .from("categorization_jobs")
      .select("user_id")
      .eq("id", transaction.job_id)
      .eq("user_id", user.id)
      .single();
    if (jobError || !job) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Delete transaction
    const { error: deleteError } = await supabase
      .from("categorized_transactions")
      .delete()
      .eq("id", id);
    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete transaction" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Transaction deleted",
    });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
