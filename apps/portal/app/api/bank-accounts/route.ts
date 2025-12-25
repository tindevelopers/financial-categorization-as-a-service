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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("include_inactive") === "true";
    const accountType = searchParams.get("account_type");

    // Build query
    let query = supabase
      .from("bank_accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    if (accountType) {
      query = query.eq("account_type", accountType);
    }

    const { data: bankAccounts, error } = await query;

    if (error) {
      console.error("Error fetching bank accounts:", error);
      return NextResponse.json(
        { error: "Failed to fetch bank accounts" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      bank_accounts: bankAccounts || [],
    });
  } catch (error: any) {
    console.error("Bank accounts GET error:", error);
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
      account_name,
      account_type,
      bank_name,
      sort_code,
      account_number,
      iban,
      currency = "GBP",
      spreadsheet_tab_name,
      default_spreadsheet_id,
      company_profile_id,
    } = body;

    // Validate required fields
    if (!account_name || !account_type || !bank_name) {
      return NextResponse.json(
        { error: "account_name, account_type, and bank_name are required" },
        { status: 400 }
      );
    }

    if (!default_spreadsheet_id) {
      return NextResponse.json(
        { error: "default_spreadsheet_id is required", error_code: "SPREADSHEET_REQUIRED" },
        { status: 400 }
      );
    }

    // Validate account_type
    const validAccountTypes = ["checking", "savings", "credit_card", "business"];
    if (!validAccountTypes.includes(account_type)) {
      return NextResponse.json(
        { error: `account_type must be one of: ${validAccountTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Get tenant_id
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    // Create bank account
    const { data: bankAccount, error: insertError } = await supabase
      .from("bank_accounts")
      .insert({
        user_id: user.id,
        tenant_id: userData?.tenant_id || null,
        company_profile_id: company_profile_id || null,
        account_name,
        account_type,
        bank_name,
        sort_code: sort_code || null,
        account_number: account_number || null,
        iban: iban || null,
        currency,
        spreadsheet_tab_name: spreadsheet_tab_name || account_name,
        default_spreadsheet_id: default_spreadsheet_id || null,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating bank account:", insertError);
      return NextResponse.json(
        { error: insertError.message || "Failed to create bank account" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      bank_account: bankAccount,
    });
  } catch (error: any) {
    console.error("Bank accounts POST error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

