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

  for (const transaction of transactions) {
    try {
      const rowNumber = await findTransactionRow(
        sheets,
        spreadsheetId,
        tabName,
        transaction.fingerprint
      );

      if (rowNumber) {
        // Update existing row
        const updated = await updateTransactionRow(
          sheets,
          spreadsheetId,
          tabName,
          rowNumber,
          transaction
        );
        if (updated) {
          result.transactionsUpdated++;
          result.syncedFingerprints.push(transaction.fingerprint);
        } else {
          result.errors.push(`Failed to update transaction ${transaction.fingerprint}`);
          result.failedFingerprints.push(transaction.fingerprint);
          result.success = false;
        }
      } else {
        // Append new row
        const appended = await appendTransactionRow(
          sheets,
          spreadsheetId,
          tabName,
          transaction
        );
        if (appended) {
          result.transactionsAppended++;
          result.syncedFingerprints.push(transaction.fingerprint);
        } else {
          result.errors.push(`Failed to append transaction ${transaction.fingerprint}`);
          result.failedFingerprints.push(transaction.fingerprint);
          result.success = false;
        }
      }
    } catch (error: any) {
      result.errors.push(`Error syncing transaction ${transaction.fingerprint}: ${error.message}`);
      result.failedFingerprints.push(transaction.fingerprint);
      result.success = false;
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

