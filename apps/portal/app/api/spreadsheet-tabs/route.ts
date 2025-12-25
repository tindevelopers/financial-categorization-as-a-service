import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const spreadsheetId = searchParams.get("spreadsheet_id");

    let query = supabase
      .from("spreadsheet_tabs")
      .select("*")
      .eq("user_id", user.id)
      .order("tab_order", { ascending: true });

    if (spreadsheetId) {
      query = query.eq("spreadsheet_id", spreadsheetId);
    }

    const { data: tabs, error } = await query;

    if (error) {
      console.error("Error fetching spreadsheet tabs:", error);
      return NextResponse.json(
        { error: "Failed to fetch spreadsheet tabs" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tabs: tabs || [],
    });
  } catch (error: any) {
    console.error("Spreadsheet tabs GET error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      spreadsheet_id,
      tab_name,
      bank_account_ids = [],
      is_main_tab = false,
      tab_order = 0,
    } = body;

    if (!spreadsheet_id || !tab_name) {
      return NextResponse.json(
        { error: "spreadsheet_id and tab_name are required" },
        { status: 400 }
      );
    }

    // Validate bank_account_ids belong to user
    if (bank_account_ids.length > 0) {
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

    // Get tenant_id
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    // If this is set as main tab, unset other main tabs for this spreadsheet
    if (is_main_tab) {
      await supabase
        .from("spreadsheet_tabs")
        .update({ is_main_tab: false })
        .eq("spreadsheet_id", spreadsheet_id)
        .eq("user_id", user.id)
        .eq("is_main_tab", true);
    }

    // Create tab
    const { data: tab, error: insertError } = await supabase
      .from("spreadsheet_tabs")
      .insert({
        user_id: user.id,
        tenant_id: userData?.tenant_id || null,
        spreadsheet_id,
        tab_name,
        bank_account_ids,
        is_main_tab,
        tab_order,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating spreadsheet tab:", insertError);
      return NextResponse.json(
        { error: insertError.message || "Failed to create spreadsheet tab" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tab,
    });
  } catch (error: any) {
    console.error("Spreadsheet tabs POST error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

