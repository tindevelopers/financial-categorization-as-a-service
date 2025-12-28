/**
 * Google Cloud Document AI OCR Integration for Bank Statements
 * 
 * This module uses Google Document AI to extract transactions from PDF bank statements.
 * 
 * OCR Provider: Google Document AI
 * SDK: @google-cloud/documentai
 */

import { verifyOCRSource } from './google-document-ai';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us";
const PROCESSOR_ID = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;

export interface BankStatementTransaction {
  date: string;
  description: string;
  amount: number;
  balance?: number;
  type?: 'debit' | 'credit';
  reference?: string;
}

export interface BankStatementData {
  account_number?: string;
  account_holder?: string;
  statement_period_start?: string;
  statement_period_end?: string;
  opening_balance?: number;
  closing_balance?: number;
  transactions: BankStatementTransaction[];
  extracted_text?: string;
  confidence_score?: number;
}

/**
 * Extract transactions from a PDF bank statement using Google Document AI
 */
export async function processBankStatementOCR(
  fileData: Blob,
  filename: string
): Promise<BankStatementData> {
  // Verify OCR source configuration
  const verification = verifyOCRSource();
  
  if (!verification.configured) {
    console.warn("[DocumentAI] OCR not configured for bank statement:", verification.error);
    return {
      transactions: [],
      extracted_text: "",
      confidence_score: 0,
    };
  }

  try {
    // @ts-ignore - Optional dependency, may not be installed
    const { DocumentProcessorServiceClient } = await import("@google-cloud/documentai");
    
    // Check for JSON credentials (base64 encoded) first (for Vercel/serverless)
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    // Use JSON credentials if available (for Vercel/serverless), otherwise use file path
    const clientOptions = credentialsJson
      ? {
          credentials: JSON.parse(
            Buffer.from(credentialsJson, "base64").toString("utf-8")
          ),
        }
      : {
          keyFilename: credentialsPath,
        };
    
    const client = new DocumentProcessorServiceClient(clientOptions);

    const processorName = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;

    // Convert blob to buffer
    const fileBuffer = Buffer.from(await fileData.arrayBuffer());

    // Call Document AI
    const [result] = await client.processDocument({
      name: processorName,
      rawDocument: {
        content: fileBuffer,
        mimeType: "application/pdf",
      },
    });

    const document = result.document;
    if (!document) {
      throw new Error("No document returned from OCR");
    }

    console.log("[DocumentAI] Processing bank statement with Google Document AI", {
      projectId: PROJECT_ID,
      location: LOCATION,
      processorId: PROCESSOR_ID,
      filename,
    });

    // Parse bank statement data
    const bankStatementData = parseBankStatementData(document);

    return bankStatementData;
  } catch (error: any) {
    console.error("[DocumentAI] Bank statement OCR error:", error?.message || "Unknown error");
    return {
      transactions: [],
      extracted_text: "",
      confidence_score: 0,
    };
  }
}

/**
 * Parse bank statement data from Document AI response
 */
function parseBankStatementData(document: any): BankStatementData {
  const data: BankStatementData = {
    transactions: [],
    extracted_text: document.text || "",
    confidence_score: 0.9, // Document AI is generally very accurate
  };

  // Extract entities from Document AI response
  if (document.entities) {
    for (const entity of document.entities) {
      const type = entity.type?.toLowerCase();
      const value = entity.normalizedValue?.textValue || entity.mentionText;

      switch (type) {
        case "account_number":
        case "account_no":
          data.account_number = value;
          break;
        case "account_holder":
        case "account_name":
          data.account_holder = value;
          break;
        case "statement_period_start":
        case "period_start":
          data.statement_period_start = parseDate(value);
          break;
        case "statement_period_end":
        case "period_end":
          data.statement_period_end = parseDate(value);
          break;
        case "opening_balance":
        case "beginning_balance":
          data.opening_balance = parseAmount(value);
          break;
        case "closing_balance":
        case "ending_balance":
          data.closing_balance = parseAmount(value);
          break;
      }
    }
  }

  // Extract transactions from tables
  if (document.pages && document.pages.length > 0) {
    for (const page of document.pages) {
      if (page.tables) {
        for (const table of page.tables) {
          const transactions = extractTransactionsFromTable(table, document.text);
          data.transactions.push(...transactions);
        }
      }
    }
  }

  // If no transactions found in tables, try to extract from text using patterns
  if (data.transactions.length === 0 && document.text) {
    data.transactions = extractTransactionsFromText(document.text);
  }

  return data;
}

/**
 * Extract transactions from a table structure
 */
function extractTransactionsFromTable(table: any, fullText: string): BankStatementTransaction[] {
  const transactions: BankStatementTransaction[] = [];

  if (!table.headerRows || !table.bodyRows) {
    return transactions;
  }

  // Try to identify column indices
  let dateColIdx = -1;
  let descColIdx = -1;
  let amountColIdx = -1;
  let balanceColIdx = -1;

  // Parse header row to find column positions
  if (table.headerRows.length > 0) {
    const headerRow = table.headerRows[0];
    if (headerRow.cells) {
      headerRow.cells.forEach((cell: any, idx: number) => {
        const cellText = cell.layout?.textBlock?.text?.toLowerCase() || "";
        if (cellText.includes("date") || cellText.includes("trans date")) {
          dateColIdx = idx;
        } else if (
          cellText.includes("description") ||
          cellText.includes("memo") ||
          cellText.includes("details") ||
          cellText.includes("payee")
        ) {
          descColIdx = idx;
        } else if (cellText.includes("amount") || cellText.includes("debit") || cellText.includes("credit")) {
          amountColIdx = idx;
        } else if (cellText.includes("balance")) {
          balanceColIdx = idx;
        }
      });
    }
  }

  // Parse body rows
  for (const row of table.bodyRows) {
    if (!row.cells || row.cells.length === 0) continue;

    const transaction: Partial<BankStatementTransaction> = {};

    // Extract date
    if (dateColIdx >= 0 && row.cells[dateColIdx]) {
      const dateText = row.cells[dateColIdx].layout?.textBlock?.text || "";
      transaction.date = parseDate(dateText);
    }

    // Extract description
    if (descColIdx >= 0 && row.cells[descColIdx]) {
      transaction.description = row.cells[descColIdx].layout?.textBlock?.text?.trim() || "";
    }

    // Extract amount
    if (amountColIdx >= 0 && row.cells[amountColIdx]) {
      const amountText = row.cells[amountColIdx].layout?.textBlock?.text || "";
      transaction.amount = parseAmount(amountText) || 0;
      
      // Determine if debit or credit (negative usually means debit)
      if (transaction.amount < 0) {
        transaction.type = "debit";
        transaction.amount = Math.abs(transaction.amount);
      } else {
        transaction.type = "credit";
      }
    }

    // Extract balance
    if (balanceColIdx >= 0 && row.cells[balanceColIdx]) {
      const balanceText = row.cells[balanceColIdx].layout?.textBlock?.text || "";
      transaction.balance = parseAmount(balanceText);
    }

    // Only add if we have essential fields
    if (transaction.date && transaction.description && transaction.amount !== undefined) {
      transactions.push(transaction as BankStatementTransaction);
    }
  }

  return transactions;
}

/**
 * Extract transactions from plain text using pattern matching
 * Fallback method when table extraction fails
 */
function extractTransactionsFromText(text: string): BankStatementTransaction[] {
  const transactions: BankStatementTransaction[] = [];
  
  // Common patterns for bank statement transactions
  // Date formats: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g;
  const amountPattern = /([\d,]+\.\d{2})/g;
  
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Look for lines that might contain transaction data
    const dateMatch = line.match(datePattern);
    const amountMatches = line.match(amountPattern);
    
    if (dateMatch && amountMatches && amountMatches.length > 0) {
      const date = parseDate(dateMatch[0]);
      const amount = parseAmount(amountMatches[amountMatches.length - 1]) || 0; // Usually last number is amount
      
      if (date && amount > 0) {
        // Extract description (everything between date and amount)
        const description = line
          .replace(dateMatch[0], '')
          .replace(amountMatches[amountMatches.length - 1], '')
          .trim();
        
        if (description.length > 3) {
          transactions.push({
            date,
            description,
            amount: Math.abs(amount),
            type: amount < 0 ? 'debit' : 'credit',
          });
        }
      }
    }
  }
  
  return transactions;
}

function parseDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  
  // Try to parse common date formats
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split("T")[0];
  }
  
  return value; // Return as-is if parsing fails
}

function parseAmount(value: string | undefined): number | undefined {
  if (!value) return undefined;
  
  // Remove currency symbols, commas, and parse number
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const amount = parseFloat(cleaned);
  
  return isNaN(amount) ? undefined : amount;
}

