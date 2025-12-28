/**
 * Google Cloud Document AI OCR Integration
 * 
 * This module uses Google Document AI (https://cloud.google.com/document-ai) 
 * for OCR processing of invoices and financial documents.
 * 
 * OCR Provider: Google Document AI
 * SDK: @google-cloud/documentai
 * 
 * Required Environment Variables:
 * - GOOGLE_CLOUD_PROJECT_ID: Google Cloud project ID
 * - GOOGLE_DOCUMENT_AI_PROCESSOR_ID: Document AI processor ID
 * - GOOGLE_APPLICATION_CREDENTIALS: Path to service account credentials JSON file
 * - GOOGLE_CLOUD_LOCATION: (Optional) Location, defaults to "us"
 */

// Optional import - Google Cloud Document AI SDK
// Only used if @google-cloud/documentai is installed
// Using dynamic import to handle optional dependency

// Trim whitespace/newlines from environment variables
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();
const LOCATION = (process.env.GOOGLE_CLOUD_LOCATION || "us").trim();
const PROCESSOR_ID = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID?.trim();

export interface InvoiceData {
  vendor_name?: string;
  invoice_date?: string;
  invoice_number?: string;
  line_items?: Array<{
    description: string;
    quantity?: number;
    unit_price?: number;
    total: number;
  }>;
  subtotal?: number;
  tax?: number;
  total?: number;
  currency?: string;
  extracted_text?: string;
  confidence_score?: number;
  fee_amount?: number;
  shipping_amount?: number;
  // OCR status flags
  ocr_configured?: boolean;
  ocr_failed?: boolean;
  ocr_error?: string;
}

/**
 * Verify that Google Document AI is properly configured
 * @returns Object with verification status and details
 */
export function verifyOCRSource(): {
  configured: boolean;
  provider: string;
  hasProjectId: boolean;
  hasProcessorId: boolean;
  hasCredentials: boolean;
  error?: string;
} {
  const hasProjectId = !!PROJECT_ID;
  const hasProcessorId = !!PROCESSOR_ID;
  const hasCredentials = !!(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  );
  
  const configured = hasProjectId && hasProcessorId && hasCredentials;
  
  let error: string | undefined;
  if (!configured) {
    const missing: string[] = [];
    if (!hasProjectId) missing.push("GOOGLE_CLOUD_PROJECT_ID");
    if (!hasProcessorId) missing.push("GOOGLE_DOCUMENT_AI_PROCESSOR_ID");
    if (!hasCredentials) missing.push("GOOGLE_APPLICATION_CREDENTIALS");
    error = `Missing required environment variables: ${missing.join(", ")}`;
  }
  
  return {
    configured,
    provider: "google_document_ai",
    hasProjectId,
    hasProcessorId,
    hasCredentials,
    error,
  };
}

export async function processInvoiceOCR(
  fileData: Blob,
  filename: string
): Promise<InvoiceData> {
  // Verify OCR source configuration
  const verification = verifyOCRSource();
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'google-document-ai.ts:87',message:'OCR processing started',data:{filename,configured:verification.configured,hasProjectId:verification.hasProjectId,hasProcessorId:verification.hasProcessorId,hasCredentials:verification.hasCredentials,error:verification.error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
  // #endregion
  
  if (!verification.configured) {
    console.warn("[DocumentAI] OCR not configured:", verification.error);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'google-document-ai.ts:90',message:'OCR not configured, returning empty',data:{filename,error:verification.error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    // Return basic structure with ocr_configured flag if Document AI not configured
    return {
      extracted_text: "",
      confidence_score: 0,
      ocr_configured: false,
      ocr_failed: true,
      ocr_error: verification.error,
    };
  }

  // Try to use Document AI SDK if available
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
    
    console.log("[DocumentAI] Processing invoice with Google Document AI", {
      projectId: PROJECT_ID,
      location: LOCATION,
      processorId: PROCESSOR_ID,
      filename,
    });

    const processorName = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;

    // Convert blob to buffer
    const fileBuffer = Buffer.from(await fileData.arrayBuffer());

    // Determine MIME type
    const mimeType = filename.endsWith(".pdf")
      ? "application/pdf"
      : filename.match(/\.(jpg|jpeg)$/i)
      ? "image/jpeg"
      : "image/png";

    // Call Document AI
    const [result] = await client.processDocument({
      name: processorName,
      rawDocument: {
        content: fileBuffer,
        mimeType,
      },
    });

    const document = result.document;
    if (!document) {
      throw new Error("No document returned from OCR");
    }

    // Parse invoice data
    const invoiceData = parseInvoiceData(document);

    // Mark as successfully processed
    invoiceData.ocr_configured = true;
    invoiceData.ocr_failed = false;

    return invoiceData;
  } catch (error: any) {
    // SDK not available or error - return basic structure with error info
    console.log("[DocumentAI] SDK not available or error:", error?.message || "Unknown error");
    return {
      extracted_text: "",
      confidence_score: 0,
      ocr_configured: true, // Was configured but failed
      ocr_failed: true,
      ocr_error: error?.message || "OCR processing failed",
    };
  }
}

function parseInvoiceData(document: any): InvoiceData {
  const data: InvoiceData = {
    extracted_text: document.text || "",
    confidence_score: 0.9, // Document AI is generally very accurate
  };

  // Parse entities from Document AI response
  if (document.entities) {
    for (const entity of document.entities) {
      const type = entity.type?.toLowerCase();
      const value = entity.normalizedValue?.textValue || entity.mentionText;

      switch (type) {
        case "supplier_name":
        case "vendor_name":
        case "merchant_name":
          data.vendor_name = value;
          break;
        case "invoice_date":
        case "receipt_date":
          data.invoice_date = parseDate(value);
          break;
        case "invoice_id":
        case "invoice_number":
          data.invoice_number = value;
          break;
        case "net_amount":
        case "subtotal":
          data.subtotal = parseAmount(value);
          break;
        case "tax_amount":
          data.tax = parseAmount(value);
          break;
        case "total_amount":
        case "total":
          data.total = parseAmount(value);
          break;
        case "currency":
          data.currency = value?.toUpperCase() || "USD";
          break;
      }
    }
  }

  // Parse line items from tables if available
  if (document.pages && document.pages[0]?.tables) {
    data.line_items = [];
    // Extract line items from tables
    for (const table of document.pages[0].tables) {
      if (table.headerRows && table.bodyRows) {
        // Parse table rows to extract line items
        for (const row of table.bodyRows) {
          const cells = row.cells || [];
          if (cells.length >= 2) {
            // Try to extract description, quantity, unit price, and total
            let description = "";
            let quantity: number | undefined;
            let unitPrice: number | undefined;
            let total: number | undefined;

            // Common table structures:
            // [Description, Qty, Unit Price, Total]
            // [Description, Amount]
            // [Item, Price]
            for (let i = 0; i < cells.length; i++) {
              const cellText = cells[i]?.text || "";
              const cellTextLower = cellText.toLowerCase();

              // Description is usually the first column or contains text
              if (i === 0 && cellText && !parseAmount(cellText)) {
                description = cellText.trim();
              }

              // Try to identify amounts
              const amount = parseAmount(cellText);
              if (amount !== undefined) {
                if (total === undefined) {
                  total = amount;
                } else if (unitPrice === undefined && cells.length > 2) {
                  unitPrice = amount;
                  total = amount; // Reassign if we find unit price
                }
              }

              // Quantity is usually a small number
              if (cellText.match(/^\d+$/) && parseFloat(cellText) < 1000) {
                quantity = parseFloat(cellText);
              }
            }

            if (description && total !== undefined) {
              data.line_items!.push({
                description,
                quantity,
                unit_price: unitPrice,
                total,
              });
            }
          }
        }
      }
    }
  }

  // Also check for line items in entities
  if (document.entities && !data.line_items) {
    data.line_items = [];
    const lineItemEntities = document.entities.filter((e: any) => 
      e.type?.toLowerCase().includes("line_item") || 
      e.type?.toLowerCase().includes("item")
    );

    for (const entity of lineItemEntities) {
      const properties = entity.properties || {};
      const description = properties.description?.textValue || properties.item?.textValue || "";
      const quantity = parseAmount(properties.quantity?.textValue || properties.qty?.textValue);
      const unitPrice = parseAmount(properties.unit_price?.textValue || properties.price?.textValue);
      const total = parseAmount(properties.amount?.textValue || properties.total?.textValue);

      if (description && total !== undefined) {
        data.line_items.push({
          description,
          quantity,
          unit_price: unitPrice,
          total,
        });
      }
    }
  }

  // Extract fees and shipping from entities if available
  if (document.entities) {
    for (const entity of document.entities) {
      const type = entity.type?.toLowerCase();
      const value = entity.normalizedValue?.textValue || entity.mentionText;
      const amount = parseAmount(value);

      if (amount !== undefined) {
        if (type?.includes("fee") || type?.includes("service")) {
          // Store fee amount (will be added to fee_amount field)
          if (!data.fee_amount) data.fee_amount = amount;
        } else if (type?.includes("shipping") || type?.includes("delivery")) {
          // Store shipping amount
          if (!data.shipping_amount) data.shipping_amount = amount;
        }
      }
    }
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'google-document-ai.ts:308',message:'OCR processing completed',data:{hasTotal:!!data.total,total:data.total,hasLineItems:!!data.line_items,lineItemsCount:data.line_items?.length||0,vendorName:data.vendor_name,hasDate:!!data.invoice_date},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
  // #endregion
  return data;
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
  
  // Remove currency symbols and parse number
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const amount = parseFloat(cleaned);
  
  return isNaN(amount) ? undefined : amount;
}
