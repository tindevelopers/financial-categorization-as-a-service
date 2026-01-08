/**
 * Master Spreadsheet Management for Company Shared Drive
 * 
 * Handles:
 * - Creating/opening master spreadsheet in Shared Drive
 * - Managing individual upload tabs
 * - Global deduplication via fingerprint tracking
 * - Rebuilding the consolidated "All Transactions" tab
 */

import { google, sheets_v4 } from "googleapis";

export interface TransactionRow {
  date: string;
  description: string;
  amount: number;
  is_debit?: boolean | null;
  payee_name?: string | null;
  payer_name?: string | null;
  payment_description_reference?: string | null;
  bank_transaction_type?: string | null;
  bank_category?: string | null;
  bank_subcategory?: string | null;
  paid_in_amount?: number | null;
  paid_out_amount?: number | null;
  category: string;
  subcategory?: string;
  confidence: number;
  status: string;
  fingerprint: string;
  transactionId?: string;
  sourceTab?: string;
  portalModifiedAt?: string;
  sheetModifiedAt?: string;
  sheetModifiedBy?: string;
}

interface MasterSpreadsheetConfig {
  spreadsheetId: string;
  spreadsheetName: string;
  sharedDriveId: string;
  parentFolderId?: string;
}

const ALL_TRANSACTIONS_TAB = "All Transactions";
const FINGERPRINTS_TAB = "_Fingerprints";

// Canonical schema for the editable All Transactions tab.
// Columns A-M (13):
// A Date
// B Description
// C Amount
// D Category
// E Subcategory
// F Confidence
// G Status
// H Source
// I Fingerprint
// J Transaction ID
// K Portal Modified At
// L Sheet Modified At
// M Sheet Modified By
const ALL_TRANSACTIONS_HEADER = [
  "Date",
  "Description",
  "Amount",
  "Category",
  "Subcategory",
  "Confidence",
  "Status",
  "Source",
  "Fingerprint",
  "Transaction ID",
  "Portal Modified At",
  "Sheet Modified At",
  "Sheet Modified By",
];

const ALL_TRANSACTIONS_RANGE = `'${ALL_TRANSACTIONS_TAB}'!A:M`;
const ALL_TRANSACTIONS_HEADER_RANGE = `'${ALL_TRANSACTIONS_TAB}'!A1:M1`;

/**
 * Get or create the master spreadsheet in the shared drive
 */
export async function getOrCreateMasterSpreadsheet(
  auth: any,
  sharedDriveId: string,
  parentFolderId?: string | null,
  existingSpreadsheetId?: string | null,
  spreadsheetName?: string
): Promise<MasterSpreadsheetConfig> {
  const sheets = google.sheets({ version: "v4", auth });
  const drive = google.drive({ version: "v3", auth });

  // If we have an existing spreadsheet ID, verify it still exists
  if (existingSpreadsheetId) {
    try {
      const response = await sheets.spreadsheets.get({
        spreadsheetId: existingSpreadsheetId,
      });
      
      return {
        spreadsheetId: existingSpreadsheetId,
        spreadsheetName: response.data.properties?.title || "Master Spreadsheet",
        sharedDriveId,
      };
    } catch (error: any) {
      // Spreadsheet doesn't exist or not accessible, create new one
      console.warn("Existing spreadsheet not found, creating new one:", error.message);
    }
  }

  // Create new spreadsheet in shared drive
  const title = spreadsheetName || `FinCat Bank Statements ${new Date().getFullYear()}`;
  
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [
        { properties: { title: ALL_TRANSACTIONS_TAB, index: 0 } },
        { properties: { title: FINGERPRINTS_TAB, index: 1, hidden: true } },
      ],
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId!;

  // Move spreadsheet to shared drive
  // If a parent folder is provided (recommended), place it inside that folder.
  const parentToAdd = (parentFolderId || sharedDriveId) as string;
  await drive.files.update({
    fileId: spreadsheetId,
    addParents: parentToAdd,
    removeParents: "root",
    supportsAllDrives: true,
    fields: "id, parents",
  });

  // Initialize headers for All Transactions tab
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: ALL_TRANSACTIONS_HEADER_RANGE,
    valueInputOption: "RAW",
    requestBody: {
      values: [ALL_TRANSACTIONS_HEADER],
    },
  });

  // Initialize headers for Fingerprints tab
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${FINGERPRINTS_TAB}'!A1:C1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [["Fingerprint", "Tab Name", "Row Number"]],
    },
  });

  // Format header row
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: spreadsheet.data.sheets?.[0]?.properties?.sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.5, blue: 0.3 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        },
        {
          updateSheetProperties: {
            properties: {
              sheetId: spreadsheet.data.sheets?.[0]?.properties?.sheetId,
              gridProperties: { frozenRowCount: 1 },
            },
            fields: "gridProperties.frozenRowCount",
          },
        },
        // Hide system columns (I-M) by default to keep the sheet accountant-friendly.
        // Accountants can still unhide if needed.
        {
          updateDimensionProperties: {
            range: {
              sheetId: spreadsheet.data.sheets?.[0]?.properties?.sheetId,
              dimension: "COLUMNS",
              startIndex: 8, // I (0-based)
              endIndex: 13, // M (exclusive)
            },
            properties: { hiddenByUser: true },
            fields: "hiddenByUser",
          },
        },
      ],
    },
  });

  return {
    spreadsheetId,
    spreadsheetName: title,
    sharedDriveId,
    parentFolderId: parentFolderId || undefined,
  };
}

/**
 * Ensure the All Transactions tab has the canonical header and hidden system columns.
 * Safe to call on every export/sync.
 */
export async function ensureAllTransactionsSchema(
  auth: any,
  spreadsheetId: string
): Promise<void> {
  const sheets = google.sheets({ version: "v4", auth });

  // Ensure header exists
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: ALL_TRANSACTIONS_HEADER_RANGE,
    valueInputOption: "RAW",
    requestBody: {
      values: [ALL_TRANSACTIONS_HEADER],
    },
  });

  // Attempt to hide system columns (I-M). If sheet IDs cannot be resolved, ignore.
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const allTxSheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === ALL_TRANSACTIONS_TAB
    );
    const sheetId = allTxSheet?.properties?.sheetId;
    if (sheetId == null) return;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: "COLUMNS",
                startIndex: 8,
                endIndex: 13,
              },
              properties: { hiddenByUser: true },
              fields: "hiddenByUser",
            },
          },
        ],
      },
    });
  } catch {
    // Non-fatal (permissions / missing sheet / transient)
  }
}

export interface UpsertAllTransactionsResult {
  inserted: number;
  updated: number;
  skippedDueToNewerSheetEdit: number;
}

/**
 * Upsert rows into the canonical All Transactions tab by transactionId.
 * Respects LWW by skipping overwrites when sheet_modified_at is newer than portal_modified_at.
 */
export async function upsertAllTransactionsRows(
  auth: any,
  spreadsheetId: string,
  rows: TransactionRow[]
): Promise<UpsertAllTransactionsResult> {
  const sheets = google.sheets({ version: "v4", auth });

  await ensureAllTransactionsSchema(auth, spreadsheetId);

  // Read existing rows
  const existingResp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: ALL_TRANSACTIONS_RANGE,
  });

  const existingValues = existingResp.data.values || [];
  // Row 1 is header. Data starts at row 2.
  const existingById = new Map<
    string,
    { rowNumber: number; portalModifiedAt?: string; sheetModifiedAt?: string }
  >();

  for (let i = 1; i < existingValues.length; i++) {
    const row = existingValues[i] || [];
    const transactionId = (row[9] || "").toString().trim(); // J
    if (!transactionId) continue;
    existingById.set(transactionId, {
      rowNumber: i + 1, // 1-indexed in Sheets UI
      portalModifiedAt: (row[10] || "").toString().trim(), // K
      sheetModifiedAt: (row[11] || "").toString().trim(), // L
    });
  }

  const nowIso = new Date().toISOString();

  // Prepare batch update requests
  const dataUpdates: sheets_v4.Schema$ValueRange[] = [];
  let inserted = 0;
  let updated = 0;
  let skippedDueToNewerSheetEdit = 0;

  const normalizeIso = (v?: string) => {
    if (!v) return "";
    const d = new Date(v);
    return isNaN(d.getTime()) ? "" : d.toISOString();
  };

  // Determine append start row (after existing data)
  const appendStartRow = Math.max(2, existingValues.length + 1);
  let appendCursor = appendStartRow;

  for (const tx of rows) {
    const transactionId = (tx.transactionId || "").trim();
    if (!transactionId) continue; // cannot upsert without stable id

    const existing = existingById.get(transactionId);
    const portalModifiedAt = nowIso;

    if (existing) {
      const existingPortal = normalizeIso(existing.portalModifiedAt);
      const existingSheet = normalizeIso(existing.sheetModifiedAt);
      if (existingSheet && (!existingPortal || existingSheet > existingPortal)) {
        // Sheet has a newer edit; do not overwrite on push.
        skippedDueToNewerSheetEdit++;
        continue;
      }

      // Update the existing row (A-M)
      const rowValues = [
        tx.date,
        tx.description,
        tx.amount,
        tx.category,
        tx.subcategory || "",
        `${Math.round(tx.confidence * 100)}%`,
        tx.status,
        tx.sourceTab || "", // Source
        tx.fingerprint,
        transactionId,
        portalModifiedAt,
        "", // sheet_modified_at cleared on portal push
        "", // sheet_modified_by cleared on portal push
      ];

      dataUpdates.push({
        range: `'${ALL_TRANSACTIONS_TAB}'!A${existing.rowNumber}:M${existing.rowNumber}`,
        values: [rowValues],
      });
      updated++;
    } else {
      // Append new row
      const rowValues = [
        tx.date,
        tx.description,
        tx.amount,
        tx.category,
        tx.subcategory || "",
        `${Math.round(tx.confidence * 100)}%`,
        tx.status,
        tx.sourceTab || "",
        tx.fingerprint,
        transactionId,
        portalModifiedAt,
        "",
        "",
      ];

      dataUpdates.push({
        range: `'${ALL_TRANSACTIONS_TAB}'!A${appendCursor}:M${appendCursor}`,
        values: [rowValues],
      });
      appendCursor++;
      inserted++;
    }
  }

  if (dataUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: dataUpdates,
      },
    });
  }

  return { inserted, updated, skippedDueToNewerSheetEdit };
}

/**
 * Get existing fingerprints from the hidden _Fingerprints tab
 */
export async function getExistingFingerprints(
  auth: any,
  spreadsheetId: string
): Promise<Set<string>> {
  const sheets = google.sheets({ version: "v4", auth });
  
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${FINGERPRINTS_TAB}'!A:A`,
    });

    const fingerprints = new Set<string>();
    const rows = response.data.values || [];
    
    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0]) {
        fingerprints.add(rows[i][0]);
      }
    }
    
    return fingerprints;
  } catch (error: any) {
    console.warn("Could not read fingerprints tab:", error.message);
    return new Set();
  }
}

/**
 * Find existing tab by job ID pattern in the spreadsheet
 */
export async function findExistingJobTab(
  auth: any,
  spreadsheetId: string,
  jobId: string
): Promise<{ tabName: string; sheetId: number } | null> {
  const sheets = google.sheets({ version: "v4", auth });
  
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = spreadsheet.data.sheets || [];
    
    // Look for a tab that matches this job ID pattern
    // Tab names are stored with the format: filename_YYYY-MM-DD or with jobId suffix
    for (const sheet of existingSheets) {
      const title = sheet.properties?.title || '';
      const sheetId = sheet.properties?.sheetId;
      
      // Check if the tab has jobId stored in developer metadata or matches the pattern
      // For now, we'll use a simpler approach: store job ID in a hidden cell
      if (sheetId != null && title !== ALL_TRANSACTIONS_TAB && title !== FINGERPRINTS_TAB) {
        try {
          // Check if A1000 cell contains the job ID (hidden marker)
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${title}'!Z1`,
          });
          
          const marker = response.data.values?.[0]?.[0];
          if (marker === jobId) {
            return { tabName: title, sheetId };
          }
        } catch {
          // Tab doesn't have our marker, continue
        }
      }
    }
    
    return null;
  } catch (error: any) {
    console.warn("Could not find existing job tab:", error.message);
    return null;
  }
}

/**
 * Sync (update) an existing tab with new transactions data
 */
export async function syncUploadTab(
  auth: any,
  spreadsheetId: string,
  tabName: string,
  sheetId: number,
  transactions: TransactionRow[],
  jobId: string
): Promise<{ rowCount: number }> {
  const sheets = google.sheets({ version: "v4", auth });
  
  // Clear existing data (except row 1 header)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateCells: {
            range: {
              sheetId,
              startRowIndex: 1, // Keep header
            },
            fields: "userEnteredValue",
          },
        },
      ],
    },
  });

  // Ensure header includes source statement columns first, then system columns.
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabName}'!A1:P1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        "Date",
        "Payee Name",
        "Payer Name",
        "Payment Description/Reference",
        "Transaction Type",
        "Bank Category",
        "Bank Subcategory",
        "Paid In",
        "Paid Out",
        "Amount",
        "Category",
        "Subcategory",
        "Confidence",
        "Status",
        "Fingerprint",
        "Transaction ID"
      ]],
    },
  });

  // Prepare data rows
  const dataRows = transactions.map(tx => {
    const paidIn = tx.paid_in_amount ?? (tx.is_debit === false ? tx.amount : null);
    const paidOut = tx.paid_out_amount ?? (tx.is_debit === true ? tx.amount : null);

    return [
      tx.date,
      tx.payee_name || "",
      tx.payer_name || "",
      tx.payment_description_reference || "",
      tx.bank_transaction_type || "",
      tx.bank_category || "",
      tx.bank_subcategory || "",
      paidIn ?? "",
      paidOut ?? "",
      tx.amount,
      tx.category,
      tx.subcategory || "",
      `${Math.round(tx.confidence * 100)}%`,
      tx.status,
      tx.fingerprint,
      tx.transactionId || "",
    ];
  });

  // Write data starting at row 2
  if (dataRows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tabName}'!A2`,
      valueInputOption: "RAW",
      requestBody: {
        values: dataRows,
      },
    });
  }

  // Update the job ID marker in Z1
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabName}'!Z1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[jobId]],
    },
  });

  return { rowCount: transactions.length };
}

/**
 * Add a new upload tab with transactions
 */
export async function addUploadTab(
  auth: any,
  spreadsheetId: string,
  tabName: string,
  transactions: TransactionRow[],
  jobId?: string
): Promise<{ tabName: string; rowCount: number }> {
  const sheets = google.sheets({ version: "v4", auth });
  
  // Sanitize tab name (max 100 chars, no special chars)
  const sanitizedTabName = tabName
    .replace(/[\/\\?*\[\]]/g, "_")
    .substring(0, 100);

  // First, get existing sheet info to find unique tab name
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];
  
  let finalTabName = sanitizedTabName;
  let counter = 1;
  while (existingSheets.includes(finalTabName)) {
    finalTabName = `${sanitizedTabName}_${counter}`;
    counter++;
  }

  // Create new sheet
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title: finalTabName },
          },
        },
      ],
    },
  });

  // Prepare data rows
  const header = [
    "Date",
    "Payee Name",
    "Payer Name",
    "Payment Description/Reference",
    "Transaction Type",
    "Bank Category",
    "Bank Subcategory",
    "Paid In",
    "Paid Out",
    "Amount",
    "Category",
    "Subcategory",
    "Confidence",
    "Status",
    "Fingerprint",
    "Transaction ID",
  ];
  const dataRows = transactions.map(tx => {
    const paidIn = tx.paid_in_amount ?? (tx.is_debit === false ? tx.amount : null);
    const paidOut = tx.paid_out_amount ?? (tx.is_debit === true ? tx.amount : null);

    return [
      tx.date,
      tx.payee_name || "",
      tx.payer_name || "",
      tx.payment_description_reference || "",
      tx.bank_transaction_type || "",
      tx.bank_category || "",
      tx.bank_subcategory || "",
      paidIn ?? "",
      paidOut ?? "",
      tx.amount,
      tx.category,
      tx.subcategory || "",
      `${Math.round(tx.confidence * 100)}%`,
      tx.status,
      tx.fingerprint,
      tx.transactionId || "",
    ];
  });

  // Write data to new tab
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${finalTabName}'!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [header, ...dataRows],
    },
  });

  // Get the new sheet ID for formatting
  const updatedSpreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const newSheet = updatedSpreadsheet.data.sheets?.find(s => s.properties?.title === finalTabName);
  const newSheetId = newSheet?.properties?.sheetId;

  if (newSheetId !== undefined) {
    // Format header row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: newSheetId,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.3, green: 0.4, blue: 0.6 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat)",
            },
          },
          {
            updateSheetProperties: {
              properties: {
                sheetId: newSheetId,
                gridProperties: { frozenRowCount: 1 },
              },
              fields: "gridProperties.frozenRowCount",
            },
          },
        ],
      },
    });
  }

  // Store job ID marker in hidden column Z1 for future sync
  if (jobId) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${finalTabName}'!Z1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[jobId]],
      },
    });
  }

  return { tabName: finalTabName, rowCount: transactions.length };
}

/**
 * Append new fingerprints to the hidden tracking tab
 */
export async function appendFingerprints(
  auth: any,
  spreadsheetId: string,
  fingerprints: Array<{ fingerprint: string; tabName: string; rowNumber: number }>
): Promise<void> {
  if (fingerprints.length === 0) return;

  const sheets = google.sheets({ version: "v4", auth });
  
  const rows = fingerprints.map(f => [f.fingerprint, f.tabName, f.rowNumber]);
  
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${FINGERPRINTS_TAB}'!A:C`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: rows,
    },
  });
}

/**
 * Rebuild the "All Transactions" tab by merging all upload tabs
 */
export async function rebuildAllTransactionsTab(
  auth: any,
  spreadsheetId: string
): Promise<{ totalRows: number }> {
  const sheets = google.sheets({ version: "v4", auth });
  
  // Get all sheets
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const allSheets = spreadsheet.data.sheets || [];
  
  // Find upload tabs (exclude All Transactions and _Fingerprints)
  const uploadTabs = allSheets
    .map(s => s.properties?.title)
    .filter(title => title && title !== ALL_TRANSACTIONS_TAB && title !== FINGERPRINTS_TAB) as string[];

  // Collect all transactions from upload tabs
  const allTransactions: Array<{
    date: string;
    description: string;
    amount: string;
    category: string;
    subcategory: string;
    confidence: string;
    status: string;
    source: string;
    dedupeKey: string;
  }> = [];

  for (const tabName of uploadTabs) {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        // Include Transaction ID column (I) if present. For older tabs, it will just be blank.
        range: `'${tabName}'!A:I`,
      });
      
      const rows = response.data.values || [];
      // Skip header row
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row[0]) { // Has date
          const transactionId = (row[8] || "").toString().trim();
          const fingerprint = (row[7] || "").toString().trim();
          // Prefer stable DB id when available; fall back to fingerprint; finally compute a basic fingerprint.
          const fallbackKey = `${row[0] || ""}_${row[1] || ""}_${row[2] || ""}`.toLowerCase().replace(/\s+/g, "_");
          const dedupeKey = transactionId || fingerprint || fallbackKey;

          allTransactions.push({
            date: row[0] || "",
            description: row[1] || "",
            amount: row[2] || "",
            category: row[3] || "",
            subcategory: row[4] || "",
            confidence: row[5] || "",
            status: row[6] || "",
            source: tabName,
            dedupeKey,
          });
        }
      }
    } catch (error: any) {
      console.warn(`Could not read tab ${tabName}:`, error.message);
    }
  }

  // Sort by date descending
  allTransactions.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB.getTime() - dateA.getTime();
  });

  // De-dupe across tabs so re-exports / multiple uploads don't duplicate rows in "All Transactions".
  // Because we sorted desc by date, the first occurrence wins (newest row retained).
  const seen = new Set<string>();
  const uniqueTransactions = allTransactions.filter(tx => {
    if (!tx.dedupeKey) return true;
    if (seen.has(tx.dedupeKey)) return false;
    seen.add(tx.dedupeKey);
    return true;
  });

  // Get All Transactions sheet ID
  const allTxSheet = allSheets.find(s => s.properties?.title === ALL_TRANSACTIONS_TAB);
  const allTxSheetId = allTxSheet?.properties?.sheetId;

  if (allTxSheetId !== undefined) {
    // Clear existing data (except header)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: {
                sheetId: allTxSheetId,
                startRowIndex: 1, // Keep header
              },
              fields: "userEnteredValue",
            },
          },
        ],
      },
    });
  }

  // Write merged data
  if (uniqueTransactions.length > 0) {
    const dataRows = uniqueTransactions.map(tx => [
      tx.date,
      tx.description,
      tx.amount,
      tx.category,
      tx.subcategory,
      tx.confidence,
      tx.status,
      tx.source,
    ]);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${ALL_TRANSACTIONS_TAB}'!A2`,
      valueInputOption: "RAW",
      requestBody: {
        values: dataRows,
      },
    });
  }

  return { totalRows: uniqueTransactions.length };
}

/**
 * Generate a tab name from filename and date
 */
export function generateTabName(filename: string, uploadDate?: Date): string {
  const date = uploadDate || new Date();
  const dateStr = date.toISOString().split("T")[0];
  
  // Extract base filename without extension
  const baseName = filename
    .replace(/\.[^.]+$/, "") // Remove extension
    .replace(/[\/\\?*\[\]]/g, "_") // Remove invalid chars
    .substring(0, 80); // Leave room for date
  
  return `${baseName}_${dateStr}`;
}

