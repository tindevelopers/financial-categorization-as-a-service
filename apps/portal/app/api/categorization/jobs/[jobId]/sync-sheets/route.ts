import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";
import { createTenantGoogleClientsForRequestUser } from "@/lib/google-sheets/tenant-clients";
import { syncUploadTab, TransactionRow, findExistingJobTab } from "@/lib/google-sheets/master-spreadsheet";
import { syncTransactionsToSheet, getSheetId } from "@/lib/google-sheets/incremental-sync";
import { generateTransactionFingerprint } from "@/lib/sync/fingerprint";

/**
 * POST /api/categorization/jobs/[jobId]/sync-sheets
 * 
 * Sync transactions to Google Sheets
 * 
 * Query params:
 *   - mode: 'incremental' (default) or 'full_refresh'
 * 
 * Body (for incremental):
 *   - transaction_ids: Array of transaction IDs to sync (optional, syncs all pending if omitted)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const startTime = Date.now();
  
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
    const searchParams = request.nextUrl.searchParams;
    const mode = (searchParams.get("mode") || "incremental") as "incremental" | "full_refresh";
    
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional
    }
    const transactionIds = body.transaction_ids as string[] | undefined;

    // Verify job belongs to user
    const { data: job, error: jobError } = await supabase
      .from("categorization_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Get spreadsheet ID from job or bank account
    let spreadsheetId: string | null = null;
    let tabName: string | null = null;
    
    if (job.spreadsheet_id) {
      spreadsheetId = job.spreadsheet_id;
    } else if (job.bank_account_id) {
      const { data: bankAccount } = await supabase
        .from("bank_accounts")
        .select("default_spreadsheet_id, spreadsheet_tab_name")
        .eq("id", job.bank_account_id)
        .single();
      
      if (bankAccount?.default_spreadsheet_id) {
        spreadsheetId = bankAccount.default_spreadsheet_id;
        tabName = bankAccount.spreadsheet_tab_name || null;
      }
    }

    if (!spreadsheetId) {
      return NextResponse.json(
        { 
          error: "No spreadsheet linked to this job",
          error_code: "NO_SPREADSHEET"
        },
        { status: 400 }
      );
    }

    // Get transactions using admin client
    const adminClient = createAdminClient();
    
    let query = adminClient
      .from("categorized_transactions")
      .select("*")
      .eq("job_id", jobId);

    if (mode === "incremental" && transactionIds && transactionIds.length > 0) {
      // Sync specific transactions
      query = query.in("id", transactionIds);
    } else if (mode === "incremental") {
      // Sync all pending transactions
      query = query.or("sync_status.is.null,sync_status.eq.pending");
    }

    const { data: transactions, error: transactionsError } = await query.order("date", { ascending: false });

    if (transactionsError || !transactions || transactions.length === 0) {
      // For incremental sync with no pending transactions, this is a success (everything is synced)
      if (mode === "incremental") {
        return NextResponse.json({
          success: true,
          mode,
          transactions_synced: 0,
          message: "No pending transactions to sync - all transactions are already synced",
        });
      }
      // For full refresh with no transactions, this is an error
      return NextResponse.json(
        { 
          success: false,
          error: "No transactions found",
          transactions_synced: 0,
          mode
        },
        { status: 400 }
      );
    }

    // Tier-aware Google clients (consumer vs business standard vs enterprise BYO)
    const tenantClients = await createTenantGoogleClientsForRequestUser();
    const auth = tenantClients.auth;
    const sheets = tenantClients.sheets;

    // Find or determine tab name
    let sheetId: number | null = null;
    if (!tabName) {
      const existingTab = await findExistingJobTab(auth, spreadsheetId, jobId);
      if (existingTab) {
        tabName = existingTab.tabName;
        sheetId = existingTab.sheetId;
      } else {
        // Use bank account tab name or generate from job
        if (job.bank_account_id) {
          const { data: bankAccount } = await supabase
            .from("bank_accounts")
            .select("spreadsheet_tab_name, account_name")
            .eq("id", job.bank_account_id)
            .single();
          tabName = bankAccount?.spreadsheet_tab_name || bankAccount?.account_name || `Job ${jobId.substring(0, 8)}`;
        } else {
          tabName = `Job ${jobId.substring(0, 8)}`;
        }
      }
    }

    if (!tabName) {
      return NextResponse.json(
        { error: "Unable to determine spreadsheet tab name" },
        { status: 500 }
      );
    }
    
    // Get sheet ID if not already found
    if (!sheetId) {
      sheetId = await getSheetId(sheets, spreadsheetId, tabName);
    }
    
    if (!sheetId && mode === "full_refresh") {
      return NextResponse.json(
        { error: `Tab "${tabName}" not found in spreadsheet` },
        { status: 404 }
      );
    }
    
    // For incremental sync, if tab doesn't exist, we'll append to the end
    // For full refresh, tab must exist

    let transactionsSynced = 0;
    let errors: string[] = [];

    if (mode === "full_refresh") {
      if (!sheetId) {
        return NextResponse.json(
          { error: `Tab "${tabName}" not found in spreadsheet` },
          { status: 404 }
        );
      }

      // Full refresh: clear and rewrite entire tab
      // Convert transactions to TransactionRow format
      const transactionRows: TransactionRow[] = transactions.map((tx: any) => ({
        date: tx.date,
        description: tx.original_description || tx.description || "",
        amount: tx.amount,
        category: tx.category || "",
        subcategory: tx.subcategory || "",
        confidence: tx.confidence_score || 0.5,
        status: tx.user_confirmed ? "Confirmed" : "Pending",
        fingerprint: generateTransactionFingerprint(
          tx.original_description || tx.description || "",
          tx.amount,
          tx.date
        ),
      }));

      await syncUploadTab(auth, spreadsheetId, tabName, sheetId, transactionRows, jobId);
      transactionsSynced = transactions.length;

      // Update all transactions as synced
      await adminClient
        .from("categorized_transactions")
        .update({
          sync_status: "synced",
          last_synced_at: new Date().toISOString(),
          sync_error: null,
        })
        .eq("job_id", jobId);
    } else {
      // Incremental sync: update only changed transactions
      const transactionRows: TransactionRow[] = transactions.map((tx: any) => ({
        date: tx.date,
        description: tx.original_description || tx.description || "",
        amount: tx.amount,
        category: tx.category || "",
        subcategory: tx.subcategory || "",
        confidence: tx.confidence_score || 0.5,
        status: tx.user_confirmed ? "Confirmed" : "Pending",
        fingerprint: generateTransactionFingerprint(
          tx.original_description || tx.description || "",
          tx.amount,
          tx.date
        ),
      }));

      const syncResult = await syncTransactionsToSheet(sheets, spreadsheetId, tabName, transactionRows);
      transactionsSynced = syncResult.transactionsUpdated + syncResult.transactionsAppended;
      errors = syncResult.errors;

      // Create fingerprint to transaction ID mapping
      const fingerprintToTxId = new Map<string, string>();
      transactionRows.forEach((row, index) => {
        if (transactions[index]) {
          fingerprintToTxId.set(row.fingerprint, transactions[index].id);
        }
      });

      // Update sync status for successfully synced transactions
      const syncedIds = syncResult.syncedFingerprints
        .map((fp) => fingerprintToTxId.get(fp))
        .filter((id): id is string => !!id);

      if (syncedIds.length > 0) {
        await adminClient
          .from("categorized_transactions")
          .update({
            sync_status: "synced",
            last_synced_at: new Date().toISOString(),
            sync_error: null,
          })
          .in("id", syncedIds);
      }

      // Update failed transactions
      const failedIds = syncResult.failedFingerprints
        .map((fp) => fingerprintToTxId.get(fp))
        .filter((id): id is string => !!id);

      if (failedIds.length > 0) {
        const errorMessages = syncResult.errors.join("; ");
        await adminClient
          .from("categorized_transactions")
          .update({
            sync_status: "failed",
            sync_error: errorMessages,
          })
          .in("id", failedIds);
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: errors.length === 0,
      mode,
      transactions_synced: transactionsSynced,
      duration_ms: duration,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Sync error:", error);
    
    // Provide more detailed error information
    const errorMessage = error.message || "Internal server error";
    const isAuthError = errorMessage.includes("authentication") || errorMessage.includes("AUTH_REQUIRED");
    const isNotFoundError = errorMessage.includes("not found") || errorMessage.includes("404");
    
    const errorMode = request.nextUrl.searchParams.get("mode") || "incremental";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        error_code: isAuthError ? "AUTH_REQUIRED" : isNotFoundError ? "NOT_FOUND" : "INTERNAL_ERROR",
        mode: errorMode,
        transactions_synced: 0,
        duration_ms: Date.now() - startTime,
      },
      { status: isAuthError ? 401 : isNotFoundError ? 404 : 500 }
    );
  }
}

