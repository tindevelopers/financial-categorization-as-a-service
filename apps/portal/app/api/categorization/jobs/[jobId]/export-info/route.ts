import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

/**
 * GET /api/categorization/jobs/[jobId]/export-info
 * Returns information about where transactions will be exported
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
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

    const { jobId } = await params;

    // Verify job belongs to user and get details
    const { data: job, error: jobError } = await supabase
      .from("categorization_jobs")
      .select("id, spreadsheet_id, bank_account_id, original_filename")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Build export info
    let destination: "job" | "bank_account" | "company" | "new" = "new";
    let spreadsheetId: string | null = null;
    let spreadsheetName: string | null = null;
    let bankAccountName: string | null = null;
    let willSync = false;

    // Priority 1: Job already has a spreadsheet (will sync)
    if (job.spreadsheet_id) {
      destination = "job";
      spreadsheetId = job.spreadsheet_id;
      willSync = true;
    }

    // Priority 2: Bank account has linked spreadsheet
    if (!spreadsheetId && job.bank_account_id) {
      const { data: bankAccount } = await supabase
        .from("bank_accounts")
        .select("id, account_name, default_spreadsheet_id")
        .eq("id", job.bank_account_id)
        .single();

      if (bankAccount) {
        bankAccountName = bankAccount.account_name;
        if (bankAccount.default_spreadsheet_id) {
          destination = "bank_account";
          spreadsheetId = bankAccount.default_spreadsheet_id;
          willSync = false; // Will append as new tab
        }
      }
    }

    // Priority 3: Company has master spreadsheet (shared drive)
    if (!spreadsheetId) {
      const { data: companyProfile } = await supabase
        .from("company_profiles")
        .select("id, google_master_spreadsheet_id, google_master_spreadsheet_name")
        .eq("user_id", user.id)
        .single();

      if (companyProfile?.google_master_spreadsheet_id) {
        destination = "company";
        spreadsheetId = companyProfile.google_master_spreadsheet_id;
        spreadsheetName = companyProfile.google_master_spreadsheet_name;
        willSync = false; // Will append as new tab
      }
    }

    // Build descriptive message
    let message = "";
    if (destination === "job") {
      message = "Will sync to existing spreadsheet (update data)";
    } else if (destination === "bank_account") {
      message = `Will append to "${bankAccountName}" account's linked spreadsheet`;
    } else if (destination === "company") {
      message = `Will append to company spreadsheet "${spreadsheetName || 'Master Sheet'}"`;
    } else {
      message = "Will create a new spreadsheet";
    }

    return NextResponse.json({
      success: true,
      destination,
      spreadsheetId,
      spreadsheetName,
      spreadsheetUrl: spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` : null,
      bankAccountName,
      willSync,
      message,
      jobFilename: job.original_filename,
    });

  } catch (error: any) {
    console.error("Export info error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get export info" },
      { status: 500 }
    );
  }
}

