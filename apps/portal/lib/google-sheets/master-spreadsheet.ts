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
  category: string;
  subcategory?: string;
  confidence: number;
  status: string;
  fingerprint: string;
  sourceTab?: string;
}

interface MasterSpreadsheetConfig {
  spreadsheetId: string;
  spreadsheetName: string;
  sharedDriveId: string;
  parentFolderId?: string;
}

const ALL_TRANSACTIONS_TAB = "All Transactions";
const FINGERPRINTS_TAB = "_Fingerprints";

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
    range: `'${ALL_TRANSACTIONS_TAB}'!A1:H1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [["Date", "Description", "Amount", "Category", "Subcategory", "Confidence", "Status", "Source"]],
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

  // Prepare data rows
  const dataRows = transactions.map(tx => [
    tx.date,
    tx.description,
    tx.amount,
    tx.category,
    tx.subcategory || "",
    `${Math.round(tx.confidence * 100)}%`,
    tx.status,
    tx.fingerprint,
  ]);

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
  const header = ["Date", "Description", "Amount", "Category", "Subcategory", "Confidence", "Status", "Fingerprint"];
  const dataRows = transactions.map(tx => [
    tx.date,
    tx.description,
    tx.amount,
    tx.category,
    tx.subcategory || "",
    `${Math.round(tx.confidence * 100)}%`,
    tx.status,
    tx.fingerprint,
  ]);

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
  }> = [];

  for (const tabName of uploadTabs) {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${tabName}'!A:H`,
      });
      
      const rows = response.data.values || [];
      // Skip header row
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row[0]) { // Has date
          allTransactions.push({
            date: row[0] || "",
            description: row[1] || "",
            amount: row[2] || "",
            category: row[3] || "",
            subcategory: row[4] || "",
            confidence: row[5] || "",
            status: row[6] || "",
            source: tabName,
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
  if (allTransactions.length > 0) {
    const dataRows = allTransactions.map(tx => [
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

  return { totalRows: allTransactions.length };
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

