/**
 * Incremental Sync Utilities for Google Sheets
 * 
 * Provides efficient row-by-row updates to Google Sheets instead of full refreshes.
 * Uses fingerprint matching to locate and update specific transactions.
 */

import { google, sheets_v4 } from "googleapis";
import { TransactionRow } from "./master-spreadsheet";

export interface SyncResult {
  success: boolean;
  transactionsUpdated: number;
  transactionsAppended: number;
  transactionsNotFound: number;
  errors: string[];
  syncedFingerprints: string[];
  failedFingerprints: string[];
}

function isQuotaError(error: any) {
  const status = error?.code || error?.status || error?.response?.status;
  return status === 429;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 4): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (!isQuotaError(err) || i === attempts - 1) break;
      const backoff = 500 * Math.pow(2, i) + Math.floor(Math.random() * 250);
      console.warn(`[sheets] quota hit during ${label}, retrying in ${backoff}ms (attempt ${i + 1}/${attempts})`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

/**
 * Find the row number of a transaction in a sheet by fingerprint
 */
export async function findTransactionRow(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string,
  fingerprint: string
): Promise<number | null> {
  try {
    // Read fingerprint column (H) starting from row 2 (skip header)
    const range = `'${tabName}'!H2:H`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const fingerprints = response.data.values || [];
    
    // Find matching fingerprint (row index + 2 because we start from row 2)
    for (let i = 0; i < fingerprints.length; i++) {
      if (fingerprints[i] && fingerprints[i][0] === fingerprint) {
        return i + 2; // +2 because row 1 is header, and array is 0-indexed
      }
    }

    return null;
  } catch (error) {
    console.error("Error finding transaction row:", error);
    return null;
  }
}

/**
 * Update a single transaction row in Google Sheets
 */
export async function updateTransactionRow(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string,
  rowNumber: number,
  transaction: TransactionRow
): Promise<boolean> {
  try {
    const rowData = [
      transaction.date,
      transaction.description,
      transaction.amount,
      transaction.category,
      transaction.subcategory || "",
      `${Math.round(transaction.confidence * 100)}%`,
      transaction.status,
      transaction.fingerprint,
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tabName}'!A${rowNumber}:H${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [rowData],
      },
    });

    return true;
  } catch (error) {
    console.error(`Error updating row ${rowNumber}:`, error);
    return false;
  }
}

/**
 * Append a transaction to the end of a sheet
 */
export async function appendTransactionRow(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string,
  transaction: TransactionRow
): Promise<boolean> {
  try {
    const rowData = [
      transaction.date,
      transaction.description,
      transaction.amount,
      transaction.category,
      transaction.subcategory || "",
      `${Math.round(transaction.confidence * 100)}%`,
      transaction.status,
      transaction.fingerprint,
    ];

    // Find the last row by reading a large range and finding the last non-empty row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tabName}'!A:A`,
    });

    const rows = response.data.values || [];
    const nextRow = rows.length + 1;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tabName}'!A${nextRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [rowData],
      },
    });

    return true;
  } catch (error) {
    console.error("Error appending transaction:", error);
    return false;
  }
}

type SheetIndex = {
  fingerprintToRow: Map<string, number>;
  nextRow: number;
};

async function getSheetIndex(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string
): Promise<SheetIndex> {
  // 1 read request for A:A + H2:H
  const res = await withRetry(
    () =>
      sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: [`'${tabName}'!A:A`, `'${tabName}'!H2:H`],
      }),
    "batchGet(sheetIndex)"
  );

  const valueRanges = res.data.valueRanges || [];
  const colA = valueRanges[0]?.values || [];
  const fpCol = valueRanges[1]?.values || [];

  const fingerprintToRow = new Map<string, number>();
  for (let i = 0; i < fpCol.length; i++) {
    const fp = fpCol[i]?.[0];
    if (fp) fingerprintToRow.set(fp, i + 2); // starts at row 2
  }

  // next row after the last non-empty A cell (A includes header row)
  const nextRow = (colA?.length || 0) + 1;
  return { fingerprintToRow, nextRow };
}

function toRowData(transaction: TransactionRow) {
  return [
    transaction.date,
    transaction.description,
    transaction.amount,
    transaction.category,
    transaction.subcategory || "",
    `${Math.round(transaction.confidence * 100)}%`,
    transaction.status,
    transaction.fingerprint,
  ];
}

/**
 * Sync multiple transactions incrementally to a Google Sheet
 */
export async function syncTransactionsToSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string,
  transactions: TransactionRow[]
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    transactionsUpdated: 0,
    transactionsAppended: 0,
    transactionsNotFound: 0,
    errors: [],
    syncedFingerprints: [],
    failedFingerprints: [],
  };

  // Build index with 1-2 reads total (instead of per-transaction reads).
  const { fingerprintToRow } = await getSheetIndex(sheets, spreadsheetId, tabName);

  const updates: Array<{ range: string; values: any[][]; fingerprint: string }> = [];
  const appends: Array<{ values: any[]; fingerprint: string }> = [];

  for (const tx of transactions) {
    const row = fingerprintToRow.get(tx.fingerprint);
    if (row) {
      updates.push({
        range: `'${tabName}'!A${row}:H${row}`,
        values: [toRowData(tx)],
        fingerprint: tx.fingerprint,
      });
    } else {
      appends.push({ values: toRowData(tx), fingerprint: tx.fingerprint });
    }
  }

  // Batch update existing rows (chunked to keep request size sane)
  const chunkSize = 200;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    try {
      await withRetry(
        () =>
          sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
              valueInputOption: "RAW",
              data: chunk.map((u) => ({ range: u.range, values: u.values })),
            },
          }),
        "batchUpdate(rows)"
      );
      result.transactionsUpdated += chunk.length;
      result.syncedFingerprints.push(...chunk.map((c) => c.fingerprint));
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Failed to update ${chunk.length} transaction(s): ${error.message}`);
      result.failedFingerprints.push(...chunk.map((c) => c.fingerprint));
    }
  }

  // Append new rows in a single call (also chunked)
  for (let i = 0; i < appends.length; i += chunkSize) {
    const chunk = appends.slice(i, i + chunkSize);
    try {
      await withRetry(
        () =>
          sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `'${tabName}'!A1`,
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: {
              values: chunk.map((c) => c.values),
            },
          }),
        "append(rows)"
      );
      result.transactionsAppended += chunk.length;
      result.syncedFingerprints.push(...chunk.map((c) => c.fingerprint));
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Failed to append ${chunk.length} transaction(s): ${error.message}`);
      result.failedFingerprints.push(...chunk.map((c) => c.fingerprint));
    }
  }

  return result;
}

/**
 * Get sheet ID for a tab name
 */
export async function getSheetId(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string
): Promise<number | null> {
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === tabName
    );
    return sheet?.properties?.sheetId || null;
  } catch (error) {
    console.error("Error getting sheet ID:", error);
    return null;
  }
}

