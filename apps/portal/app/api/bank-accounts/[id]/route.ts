import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Verify bank account belongs to user
    const { data: existing, error: fetchError } = await supabase
      .from("bank_accounts")
      .select("id, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Bank account not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      account_name,
      account_type,
      bank_name,
      sort_code,
      account_number,
      iban,
      currency,
      spreadsheet_tab_name,
      default_spreadsheet_id,
      is_active,
    } = body;

    // Build update object
    const updates: any = {};
    if (account_name !== undefined) updates.account_name = account_name;
    if (account_type !== undefined) {
      const validAccountTypes = ["checking", "savings", "credit_card", "business"];
      if (!validAccountTypes.includes(account_type)) {
        return NextResponse.json(
          { error: `account_type must be one of: ${validAccountTypes.join(", ")}` },
          { status: 400 }
        );
      }
      updates.account_type = account_type;
    }
    if (bank_name !== undefined) updates.bank_name = bank_name;
    if (sort_code !== undefined) updates.sort_code = sort_code;
    if (account_number !== undefined) updates.account_number = account_number;
    if (iban !== undefined) updates.iban = iban;
    if (currency !== undefined) updates.currency = currency;
    if (spreadsheet_tab_name !== undefined) updates.spreadsheet_tab_name = spreadsheet_tab_name;
    // Allow setting to null to unlink sheet, or setting to a new value
    if (default_spreadsheet_id !== undefined) {
      updates.default_spreadsheet_id = default_spreadsheet_id || null;
    }
    if (is_active !== undefined) updates.is_active = is_active;

    // Update bank account
    const { data: bankAccount, error: updateError } = await supabase
      .from("bank_accounts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating bank account:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update bank account" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      bank_account: bankAccount,
    });
  } catch (error: any) {
    console.error("Bank accounts PATCH error:", error);
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
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify bank account belongs to user
    const { data: existing, error: fetchError } = await supabase
      .from("bank_accounts")
      .select("id, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Bank account not found" },
        { status: 404 }
      );
    }

    // Soft delete (set is_active to false)
    const { error: deleteError } = await supabase
      .from("bank_accounts")
      .update({ is_active: false })
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting bank account:", deleteError);
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete bank account" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Bank account deleted successfully",
    });
  } catch (error: any) {
    console.error("Bank accounts DELETE error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

