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

    // Verify tab belongs to user
    const { data: existing, error: fetchError } = await supabase
      .from("spreadsheet_tabs")
      .select("id, user_id, spreadsheet_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Spreadsheet tab not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      tab_name,
      bank_account_ids,
      is_main_tab,
      tab_order,
    } = body;

    // Validate bank_account_ids if provided
    if (bank_account_ids !== undefined && bank_account_ids.length > 0) {
      const { data: bankAccounts, error: bankAccountError } = await supabase
        .from("bank_accounts")
        .select("id")
        .eq("user_id", user.id)
        .in("id", bank_account_ids);

      if (bankAccountError || !bankAccounts || bankAccounts.length !== bank_account_ids.length) {
        return NextResponse.json(
          { error: "Invalid bank account IDs" },
          { status: 400 }
        );
      }
    }

    // If setting as main tab, unset other main tabs
    if (is_main_tab === true) {
      await supabase
        .from("spreadsheet_tabs")
        .update({ is_main_tab: false })
        .eq("spreadsheet_id", existing.spreadsheet_id)
        .eq("user_id", user.id)
        .eq("is_main_tab", true)
        .neq("id", id);
    }

    // Build update object
    const updates: any = {};
    if (tab_name !== undefined) updates.tab_name = tab_name;
    if (bank_account_ids !== undefined) updates.bank_account_ids = bank_account_ids;
    if (is_main_tab !== undefined) updates.is_main_tab = is_main_tab;
    if (tab_order !== undefined) updates.tab_order = tab_order;

    // Update tab
    const { data: tab, error: updateError } = await supabase
      .from("spreadsheet_tabs")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating spreadsheet tab:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update spreadsheet tab" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tab,
    });
  } catch (error: any) {
    console.error("Spreadsheet tabs PATCH error:", error);
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

    // Verify tab belongs to user
    const { data: existing, error: fetchError } = await supabase
      .from("spreadsheet_tabs")
      .select("id, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Spreadsheet tab not found" },
        { status: 404 }
      );
    }

    // Delete tab
    const { error: deleteError } = await supabase
      .from("spreadsheet_tabs")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting spreadsheet tab:", deleteError);
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete spreadsheet tab" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Spreadsheet tab deleted successfully",
    });
  } catch (error: any) {
    console.error("Spreadsheet tabs DELETE error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

