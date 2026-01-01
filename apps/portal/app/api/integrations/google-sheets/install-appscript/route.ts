import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/database/server";
import { createAdminClient } from "@/lib/database/admin-client";
import { createTenantGoogleClientsForRequestUser } from "@/lib/google-sheets/tenant-clients";
import { ensureAllTransactionsSchema } from "@/lib/google-sheets/master-spreadsheet";

const ALL_TRANSACTIONS_TAB = "All Transactions";

const APPS_SCRIPT_SOURCE = `/**
 * FinCat row-level edit stamping for LWW sync.
 *
 * Stamps:
 * - Sheet Modified At (ISO timestamp)
 * - Sheet Modified By (editor email if available)
 *
 * Notes:
 * - Only fires on user edits (not API writes), which avoids sync loops.
 * - Requires All Transactions header row to contain the expected column names.
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;

    var sheet = e.range.getSheet();
    if (!sheet) return;

    var sheetName = sheet.getName();
    if (sheetName !== 'All Transactions') return;

    var row = e.range.getRow();
    if (row < 2) return; // skip header

    // Find the system columns by header labels (row 1)
    var lastCol = sheet.getLastColumn();
    if (lastCol < 1) return;

    var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    var portalModifiedAtCol = header.indexOf('Portal Modified At') + 1;
    var sheetModifiedAtCol = header.indexOf('Sheet Modified At') + 1;
    var sheetModifiedByCol = header.indexOf('Sheet Modified By') + 1;

    if (!sheetModifiedAtCol) return; // cannot stamp without the column

    // Avoid stamping when the edit itself is in the stamping columns
    var editedCol = e.range.getColumn();
    if (editedCol === sheetModifiedAtCol || editedCol === sheetModifiedByCol || editedCol === portalModifiedAtCol) {
      return;
    }

    var nowIso = new Date().toISOString();
    sheet.getRange(row, sheetModifiedAtCol).setValue(nowIso);

    // Best-effort editor identity (requires domain/admin settings; may be blank)
    var email = '';
    try {
      email = Session.getActiveUser().getEmail() || '';
    } catch (err) {
      email = '';
    }

    if (sheetModifiedByCol) {
      sheet.getRange(row, sheetModifiedByCol).setValue(email);
    }
  } catch (err) {
    // Fail closed: do not interrupt spreadsheet editing
    // Logger.log(err);
  }
}
`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const spreadsheetId = (body?.spreadsheetId || "").toString().trim();
    const spreadsheetName = (body?.spreadsheetName || "").toString().trim() || null;

    if (!spreadsheetId) {
      return NextResponse.json({ error: "spreadsheetId is required" }, { status: 400 });
    }

    const tenantClients = await createTenantGoogleClientsForRequestUser();
    const auth = tenantClients.auth;

    // Ensure the sheet is accessible and schema exists
    await ensureAllTransactionsSchema(auth, spreadsheetId);

    // Create a container-bound Apps Script project on this spreadsheet
    const script = google.script({ version: "v1", auth } as any);

    let projectId: string;
    try {
      const created = await (script as any).projects.create({
        requestBody: {
          title: "FinCat Sheet Sync",
          parentId: spreadsheetId,
        },
      });
      projectId = created.data.scriptId as string;
    } catch (e: any) {
      const message = e?.message || "Failed to create Apps Script project";
      const isScopes =
        message.toLowerCase().includes("insufficient") ||
        message.toLowerCase().includes("permission") ||
        e?.code === 403;
      return NextResponse.json(
        {
          error: message,
          error_code: isScopes ? "INSUFFICIENT_SCOPES" : "SCRIPT_CREATE_FAILED",
          guidance: isScopes
            ? "Please reconnect Google Sheets to grant the additional Apps Script permissions, then try again."
            : "Please try again, or contact support if this persists.",
        },
        { status: isScopes ? 403 : 500 }
      );
    }

    // Write code content
    await (script as any).projects.updateContent({
      scriptId: projectId,
      requestBody: {
        files: [
          {
            name: "Code",
            type: "SERVER_JS",
            source: APPS_SCRIPT_SOURCE,
          },
          {
            name: "appsscript",
            type: "JSON",
            source: JSON.stringify(
              {
                timeZone: "Etc/UTC",
                exceptionLogging: "STACKDRIVER",
                runtimeVersion: "V8",
              },
              null,
              2
            ),
          },
        ],
      },
    });

    // Create installable onEdit trigger (best-effort; if API is unavailable, user can still add manually)
    let triggerId: string | null = null;
    try {
      const trig = await (script as any).projects.triggers.create({
        scriptId: projectId,
        requestBody: {
          trigger: {
            handlerFunction: "onEdit",
            eventType: "ON_EDIT",
            triggerSource: "SPREADSHEETS",
          },
        },
      });
      triggerId = trig?.data?.triggerId || null;
    } catch (e) {
      // Non-fatal. Some OAuth configurations may allow script creation but not trigger management.
      triggerId = null;
    }

    // Persist installation metadata for visibility (sync_metadata)
    const admin = createAdminClient();
    await admin.from("sync_metadata").upsert(
      {
        user_id: user.id,
        tenant_id: tenantClients.tenantId,
        source_type: "google_sheets",
        source_id: spreadsheetId,
        source_name: spreadsheetName,
        source_url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        last_sync_at: new Date().toISOString(),
        last_sync_direction: "bidirectional",
        sync_status: "idle",
        conflict_resolution: "last_write_wins",
        sync_cursor: JSON.stringify({
          appsScriptProjectId: projectId,
          appsScriptTriggerId: triggerId,
          installedAt: new Date().toISOString(),
          allTransactionsTab: ALL_TRANSACTIONS_TAB,
        }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,source_type,source_id" }
    );

    return NextResponse.json({
      success: true,
      spreadsheetId,
      appsScriptProjectId: projectId,
      appsScriptTriggerId: triggerId,
      message: triggerId
        ? "Apps Script installed and trigger created."
        : "Apps Script installed. Trigger creation may require manual setup; see docs/google-sheets-apps-script.md.",
    });
  } catch (error: any) {
    console.error("Install Apps Script error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}


