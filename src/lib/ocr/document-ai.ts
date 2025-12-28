/**
 * Google Document AI OCR Integration
 * Extracts text and structured data from financial documents
 */

const DOCUMENT_AI_LOCATION = process.env.GOOGLE_DOCUMENT_AI_LOCATION || "us";
const DOCUMENT_AI_PROCESSOR_ID = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
const GCS_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;

export interface OCRResult {
  success: boolean;
  text?: string;
  extractedData?: ExtractedDocumentData;
  confidence?: number;
  error?: string;
  processingTimeMs?: number;
}

export interface ExtractedDocumentData {
  // Common fields
  documentDate?: string;
  vendorName?: string;
  totalAmount?: number;
  currency?: string;
  
  // Invoice/Receipt specific
  invoiceNumber?: string;
  lineItems?: LineItem[];
  subtotal?: number;
  taxAmount?: number;
  
  // Bank statement specific
  accountNumber?: string; // Last 4 digits only
  periodStart?: string;
  periodEnd?: string;
  openingBalance?: number;
  closingBalance?: number;
  transactions?: TransactionItem[];
  
  // All detected entities
  entities?: DocumentEntity[];
  
  // Raw data from Document AI
  rawEntities?: Record<string, string>;
}

export interface LineItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
}

export interface TransactionItem {
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  balance?: number;
}

export interface DocumentEntity {
  type: string;
  value: string;
  confidence: number;
}

/**
 * Check if Document AI is configured
 */
export function isDocumentAIConfigured(): boolean {
  return !!(GCS_PROJECT_ID && DOCUMENT_AI_PROCESSOR_ID);
}

/**
 * Process a document with Google Document AI
 */
export async function processDocument(
  fileBuffer: Buffer,
  mimeType: string,
  documentType: string
): Promise<OCRResult> {
  const startTime = Date.now();

  if (!isDocumentAIConfigured()) {
    // Fallback to simulated OCR for development
    return simulatedOCR(fileBuffer, mimeType, documentType);
  }

  try {
    // Check for JSON credentials (base64 encoded) first (for Vercel/serverless)
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!credentialsJson && !credentialsPath) {
      // Simulated OCR for development
      return simulatedOCR(fileBuffer, mimeType, documentType);
    }

    // Dynamic import of Document AI SDK
    try {
      // Optional dependency, may not be installed
      const documentaiModule = await import(
        "@google-cloud/documentai"
      ) as any;
      const { DocumentProcessorServiceClient } = documentaiModule;

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

      const name = `projects/${GCS_PROJECT_ID}/locations/${DOCUMENT_AI_LOCATION}/processors/${DOCUMENT_AI_PROCESSOR_ID}`;

      const request = {
        name,
        rawDocument: {
          content: fileBuffer.toString("base64"),
          mimeType,
        },
      };

      const [result] = await client.processDocument(request);
      const document = result.document;

      if (!document) {
        return {
          success: false,
          error: "No document returned from Document AI",
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Extract text
      const text = document.text || "";

      // Calculate average confidence
      const confidences: number[] = [];
      document.pages?.forEach((page: any) => {
        page.blocks?.forEach((block: any) => {
          if (block.layout?.confidence) {
            confidences.push(block.layout.confidence);
          }
        });
      });
      const avgConfidence =
        confidences.length > 0
          ? confidences.reduce((a, b) => a + b, 0) / confidences.length
          : 0.5;

      // Extract entities
      const extractedData = extractEntitiesFromDocument(document, documentType);

      return {
        success: true,
        text,
        extractedData,
        confidence: avgConfidence,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (sdkError) {
      console.log("[Document AI] SDK not available, using simulated OCR");
      return simulatedOCR(fileBuffer, mimeType, documentType);
    }
  } catch (error) {
    console.error("Document AI error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "OCR processing failed",
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Extract structured entities from Document AI response
 */
function extractEntitiesFromDocument(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  document: any,
  documentType: string
): ExtractedDocumentData {
  const data: ExtractedDocumentData = {
    entities: [],
    rawEntities: {},
  };

  // Extract entities if available
  if (document.entities) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    document.entities.forEach((entity: any) => {
      const type = entity.type || "";
      const value = entity.mentionText || "";
      const confidence = entity.confidence || 0;

      data.entities?.push({ type, value, confidence });
      data.rawEntities![type] = value;

      // Map common entity types
      switch (type.toLowerCase()) {
        case "invoice_date":
        case "receipt_date":
        case "document_date":
        case "date":
          data.documentDate = value;
          break;
        case "supplier_name":
        case "vendor_name":
        case "merchant_name":
          data.vendorName = value;
          break;
        case "total_amount":
        case "total":
        case "grand_total":
          data.totalAmount = parseAmount(value);
          break;
        case "currency":
          data.currency = value;
          break;
        case "invoice_id":
        case "invoice_number":
          data.invoiceNumber = value;
          break;
        case "subtotal":
          data.subtotal = parseAmount(value);
          break;
        case "tax_amount":
        case "tax":
          data.taxAmount = parseAmount(value);
          break;
      }
    });
  }

  // Extract line items if available
  if (document.entities) {
    const lineItems: LineItem[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    document.entities.forEach((entity: any) => {
      if (entity.type === "line_item" && entity.properties) {
        const item: LineItem = { description: "" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        entity.properties.forEach((prop: any) => {
          switch (prop.type) {
            case "line_item/description":
              item.description = prop.mentionText || "";
              break;
            case "line_item/quantity":
              item.quantity = parseFloat(prop.mentionText || "0");
              break;
            case "line_item/unit_price":
              item.unitPrice = parseAmount(prop.mentionText || "0");
              break;
            case "line_item/amount":
              item.amount = parseAmount(prop.mentionText || "0");
              break;
          }
        });
        if (item.description) {
          lineItems.push(item);
        }
      }
    });
    if (lineItems.length > 0) {
      data.lineItems = lineItems;
    }
  }

  return data;
}

/**
 * Parse amount string to number
 */
function parseAmount(value: string): number | undefined {
  if (!value) return undefined;
  // Remove currency symbols and commas
  const cleaned = value.replace(/[$€£¥,]/g, "").trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Simulated OCR for development (when Document AI is not configured)
 */
async function simulatedOCR(
  fileBuffer: Buffer,
  mimeType: string,
  documentType: string
): Promise<OCRResult> {
  console.log(`[OCR SIMULATED] Processing ${mimeType} as ${documentType}`);
  console.log(`[OCR SIMULATED] File size: ${fileBuffer.length} bytes`);

  // Simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Generate simulated data based on document type
  const extractedData: ExtractedDocumentData = {};

  switch (documentType) {
    case "receipt":
      extractedData.vendorName = "Sample Merchant";
      extractedData.documentDate = new Date().toISOString().split("T")[0];
      extractedData.totalAmount = 42.99;
      extractedData.currency = "USD";
      extractedData.taxAmount = 3.25;
      extractedData.subtotal = 39.74;
      break;

    case "invoice":
      extractedData.vendorName = "Sample Vendor Inc.";
      extractedData.documentDate = new Date().toISOString().split("T")[0];
      extractedData.totalAmount = 1250.0;
      extractedData.currency = "USD";
      extractedData.invoiceNumber = `INV-${Date.now()}`;
      extractedData.lineItems = [
        { description: "Service Fee", quantity: 1, amount: 1000.0 },
        { description: "Materials", quantity: 1, amount: 250.0 },
      ];
      break;

    case "bank_statement":
      extractedData.accountNumber = "****1234";
      extractedData.periodStart = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split("T")[0];
      extractedData.periodEnd = new Date().toISOString().split("T")[0];
      extractedData.openingBalance = 5000.0;
      extractedData.closingBalance = 4750.0;
      extractedData.transactions = [
        {
          date: new Date().toISOString().split("T")[0],
          description: "Sample Transaction",
          amount: 250.0,
          type: "debit",
        },
      ];
      break;
  }

  return {
    success: true,
    text: `[Simulated OCR] This is simulated text extraction for a ${documentType}. In production, Google Document AI would extract actual text from the document.`,
    extractedData,
    confidence: 0.85,
    processingTimeMs: 500,
  };
}

/**
 * Determine the best processor for a document type
 */
export function getProcessorForDocumentType(
  documentType: string
): string | null {
  // In production, you might have different processors for different document types
  // For now, we use the default processor from environment
  return DOCUMENT_AI_PROCESSOR_ID || null;
}

