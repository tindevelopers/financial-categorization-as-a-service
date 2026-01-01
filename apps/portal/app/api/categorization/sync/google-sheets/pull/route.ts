import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";
import { createTenantGoogleClientsForRequestUser } from "@/lib/google-sheets/tenant-clients";
import { ensureAllTransactionsSchema } from "@/lib/google-sheets/master-spreadsheet";
import { generateTransactionFingerprint } from "@/lib/sync/fingerprint";

type PullResult = {
  success: boolean;
  spreadsheetId: string;
  jobId: string;
  rowsProcessed: number;
  rowsUpdated: number;
  rowsInserted: number;
  rowsSkipped: number;
  message?: string;
};

const ALL_TRANSACTIONS_TAB = "All Transactions";

// Column indexes (0-based) for All Transactions A-M
const COL_DATE = 0; // A
const COL_DESCRIPTION = 1; // B
const COL_AMOUNT = 2; // C
const COL_CATEGORY = 3; // D
const COL_SUBCATEGORY = 4; // E
const COL_CONFIDENCE = 5; // F
const COL_STATUS = 6; // G
const COL_SOURCE = 7; // H
const COL_FINGERPRINT = 8; // I
const COL_TRANSACTION_ID = 9; // J
const COL_PORTAL_MODIFIED_AT = 10; // K
const COL_SHEET_MODIFIED_AT = 11; // L
const COL_SHEET_MODIFIED_BY = 12; // M

function toIsoOrEmpty(value: string | undefined | null): string {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,€£¥]/g, "").replace(/,/g, "").trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function parseConfidence(value: unknown): number {
  // Accept "85%" or "0.85" or 0.85
  if (typeof value === "number") {
    if (value > 1) return Math.max(0, Math.min(1, value / 100));
    return Math.max(0, Math.min(1, value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.endsWith("%")) {
      const num = parseFloat(trimmed.slice(0, -1));
      if (!isNaN(num)) return Math.max(0, Math.min(1, num / 100));
    }
    const num = parseFloat(trimmed);
    if (!isNaN(num)) {
      if (num > 1) return Math.max(0, Math.min(1, num / 100));
      return Math.max(0, Math.min(1, num));
    }
  }
  return 0.5;
}

function parseStatus(value: unknown): boolean {
  const v = (value || "").toString().trim().toLowerCase();
  if (!v) return false;
  return v === "confirmed" || v === "true" || v === "yes" || v === "y";
}

/**
 * POST /api/categorization/sync/google-sheets/pull
 *
 * Body:
 *  - jobId: string (required)
 *
 * Reads rows from the canonical `All Transactions` tab and applies changes to the DB when:
 *  sheet_modified_at > portal_modified_at
 *
 * After applying, clears sheet_modified_at/by and stamps portal_modified_at, and refreshes the fingerprint cell.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const jobId = (body?.jobId || "").toString().trim();
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    // Verify job belongs to user and locate spreadsheet
    const { data: job, error: jobError } = await supabase
      .from("categorization_jobs")
      .select("id, user_id, spreadsheet_id, bank_account_id")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    let spreadsheetId: string | null = job.spreadsheet_id || null;
    if (!spreadsheetId && job.bank_account_id) {
      const { data: bankAccount } = await supabase
        .from("bank_accounts")
        .select("default_spreadsheet_id")
        .eq("id", job.bank_account_id)
        .eq("user_id", user.id)
        .single();
      spreadsheetId = bankAccount?.default_spreadsheet_id || null;
    }

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: "No spreadsheet linked to this job" },
        { status: 400 }
      );
    }

    // Tenant-aware Google auth
    const tenantClients = await createTenantGoogleClientsForRequestUser();
    const auth = tenantClients.auth;
    const sheets = google.sheets({ version: "v4", auth });

    // Ensure schema exists (header + hidden cols)
    await ensureAllTransactionsSchema(auth, spreadsheetId);

    // Read All Transactions rows (A:M)
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${ALL_TRANSACTIONS_TAB}'!A:M`,
    });
    const values = resp.data.values || [];

    if (values.length <= 1) {
      const result: PullResult = {
        success: true,
        spreadsheetId,
        jobId,
        rowsProcessed: 0,
        rowsUpdated: 0,
        rowsInserted: 0,
        rowsSkipped: 0,
        message: "No rows found to sync",
      };
      return NextResponse.json(result);
    }

    const admin = createAdminClient();
    const nowIso = new Date().toISOString();

    // Collect updates/inserts and sheet cell updates
    let rowsProcessed = 0;
    let rowsUpdated = 0;
    let rowsInserted = 0;
    let rowsSkipped = 0;

    // For batch DB updates, gather per-row instructions
    const updates: Array<{
      rowNumber: number;
      transactionId: string;
      payload: Record<string, unknown>;
      fingerprint: string;
    }> = [];

    const inserts: Array<{
      rowNumber: number;
      payload: Record<string, unknown>;
      fingerprint: string;
    }> = [];

    // Data starts at row 2
    for (let i = 1; i < values.length; i++) {
      const row = values[i] || [];
      const rowNumber = i + 1;

      const transactionId = (row[COL_TRANSACTION_ID] || "").toString().trim();
      const portalModifiedAt = toIsoOrEmpty((row[COL_PORTAL_MODIFIED_AT] || "").toString().trim());
      const sheetModifiedAt = toIsoOrEmpty((row[COL_SHEET_MODIFIED_AT] || "").toString().trim());

      // If no sheet_modified_at, skip (no user edit)
      if (!sheetModifiedAt) continue;

      rowsProcessed++;

      // If sheet edit is not newer than portal, skip
      if (portalModifiedAt && sheetModifiedAt <= portalModifiedAt) {
        rowsSkipped++;
        continue;
      }

      const date = (row[COL_DATE] || "").toString().trim();
      const description = (row[COL_DESCRIPTION] || "").toString().trim();
      const amount = parseAmount(row[COL_AMOUNT]);
      const category = (row[COL_CATEGORY] || "").toString().trim();
      const subcategory = (row[COL_SUBCATEGORY] || "").toString().trim();
      const confidenceScore = parseConfidence(row[COL_CONFIDENCE]);
      const userConfirmed = parseStatus(row[COL_STATUS]);

      if (!date || !description || amount == null) {
        // Incomplete row - ignore but keep stamp so user can fix.
        rowsSkipped++;
        continue;
      }

      const fingerprint = generateTransactionFingerprint(description, amount, date);

      if (transactionId) {
        updates.push({
          rowNumber,
          transactionId,
          fingerprint,
          payload: {
            original_description: description,
            amount,
            date,
            category: category || null,
            subcategory: subcategory || null,
            confidence_score: confidenceScore,
            user_confirmed: userConfirmed,
            last_modified_source: "google_sheets",
            last_synced_at: nowIso,
            sync_status: "synced",
          },
        });
      } else {
        inserts.push({
          rowNumber,
          fingerprint,
          payload: {
            job_id: jobId,
            original_description: description,
            amount,
            date,
            category: category || null,
            subcategory: subcategory || null,
            confidence_score: confidenceScore,
            user_confirmed: userConfirmed,
            source_type: "google_sheets",
            source_identifier: spreadsheetId,
            last_modified_source: "google_sheets",
            last_synced_at: nowIso,
            sync_status: "synced",
            sync_version: 1,
            transaction_fingerprint: fingerprint,
          },
        });
      }
    }

    // Apply DB updates (best-effort; keep going)
    // Note: we also bump sync_version by fetching current values first to avoid relying on triggers.
    if (updates.length > 0) {
      const ids = updates.map((u) => u.transactionId);
      const { data: existing, error: existingErr } = await admin
        .from("categorized_transactions")
        .select("id, sync_version")
        .in("id", ids);

      const versionById = new Map<string, number>();
      (existing || []).forEach((t: any) => {
        versionById.set(t.id, typeof t.sync_version === "number" ? t.sync_version : 1);
      });

      if (existingErr) {
        console.warn("Pull sync: failed to fetch sync_version; continuing without bump.", existingErr);
      }

      for (const u of updates) {
        const currentVersion = versionById.get(u.transactionId) ?? 1;
        const payloadWithVersion = {
          ...u.payload,
          transaction_fingerprint: u.fingerprint,
          sync_version: currentVersion + 1,
        };

        const { error: updErr } = await admin
          .from("categorized_transactions")
          .update(payloadWithVersion)
          .eq("id", u.transactionId);

        if (!updErr) rowsUpdated++;
      }
    }

    // Inserts: batch insert and capture generated IDs
    const insertedIdsByRow = new Map<number, string>();
    if (inserts.length > 0) {
      const insertPayloads = inserts.map((i) => i.payload);
      const { data: inserted, error: insErr } = await admin
        .from("categorized_transactions")
        .insert(insertPayloads as any)
        .select("id");

      if (!insErr && inserted) {
        // Supabase returns inserted rows in order; map back to rowNumber
        for (let idx = 0; idx < inserted.length; idx++) {
          const rowNumber = inserts[idx].rowNumber;
          insertedIdsByRow.set(rowNumber, (inserted[idx] as any).id);
          rowsInserted++;
        }
      }
    }

    // Update sheet stamps and transaction IDs / fingerprint for processed rows
    const cellUpdates: Array<{ range: string; values: any[][] }> = [];

    // For updated rows
    for (const u of updates) {
      // Update fingerprint (I), transaction_id (J - keep), portal_modified_at (K), clear L/M
      cellUpdates.push({
        range: `'${ALL_TRANSACTIONS_TAB}'!I${u.rowNumber}:M${u.rowNumber}`,
        values: [[u.fingerprint, u.transactionId, nowIso, "", ""]],
      });
    }

    // For inserted rows
    for (const ins of inserts) {
      const newId = insertedIdsByRow.get(ins.rowNumber);
      if (!newId) continue;
      cellUpdates.push({
        range: `'${ALL_TRANSACTIONS_TAB}'!I${ins.rowNumber}:M${ins.rowNumber}`,
        values: [[ins.fingerprint, newId, nowIso, "", ""]],
      });
    }

    if (cellUpdates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: cellUpdates,
        },
      });
    }

    const result: PullResult = {
      success: true,
      spreadsheetId,
      jobId,
      rowsProcessed,
      rowsUpdated,
      rowsInserted,
      rowsSkipped,
      message: "Pull sync completed",
    };
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Pull sync error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}


