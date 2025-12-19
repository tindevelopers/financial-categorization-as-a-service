import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const { id } = params;

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

    // Update transaction
    const { error: updateError } = await supabase
      .from("categorized_transactions")
      .update({ user_confirmed: true })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to confirm transaction" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Transaction confirmed",
    });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
