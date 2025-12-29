import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

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
    const { category, subcategory, supplier_id } = await request.json();

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

    const { error: updateError } = await supabase
      .from("categorized_transactions")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update transaction" },
        { status: 500 }
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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/categorization/transactions/[id]/route.ts:delete:auth',message:'DELETE transaction auth check',data:{hasUser:!!user,hasAuthError:!!authError,authErrorMessage:authError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'delete-1',hypothesisId:'D1'})}).catch(()=>{});
    // #endregion

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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/categorization/transactions/[id]/route.ts:delete:txLookup',message:'DELETE transaction lookup',data:{transactionId:id,hasTx:!!transaction,txErrorMessage:txError?.message,jobId:transaction?.job_id},timestamp:Date.now(),sessionId:'debug-session',runId:'delete-1',hypothesisId:'D2'})}).catch(()=>{});
    // #endregion

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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/categorization/transactions/[id]/route.ts:delete:jobCheck',message:'DELETE transaction job ownership check',data:{transactionId:id,jobId:transaction?.job_id,hasJob:!!job,jobErrorMessage:jobError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'delete-1',hypothesisId:'D2'})}).catch(()=>{});
    // #endregion

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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/categorization/transactions/[id]/route.ts:delete:deleteResult',message:'DELETE transaction result',data:{transactionId:id,hasDeleteError:!!deleteError,deleteErrorMessage:deleteError?.message,code:(deleteError as any)?.code,details:(deleteError as any)?.details,hint:(deleteError as any)?.hint},timestamp:Date.now(),sessionId:'debug-session',runId:'delete-1',hypothesisId:'D3'})}).catch(()=>{});
    // #endregion

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
