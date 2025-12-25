// Optional import - Google Cloud Document AI SDK
// Only used if @google-cloud/documentai is installed
// Using dynamic import to handle optional dependency

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us";
const PROCESSOR_ID = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;

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
}

export async function processInvoiceOCR(
  fileData: Blob,
  filename: string
): Promise<InvoiceData> {
  if (!PROJECT_ID || !PROCESSOR_ID) {
    // Return basic structure if Document AI not configured
    return {
      extracted_text: "",
      confidence_score: 0,
    };
  }

  // Try to use Document AI SDK if available
  try {
    // @ts-ignore - Optional dependency, may not be installed
    const { DocumentProcessorServiceClient } = await import("@google-cloud/documentai");
    const client = new DocumentProcessorServiceClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
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

    return invoiceData;
  } catch (error: any) {
    // SDK not available or error - return basic structure
    console.log("[DocumentAI] SDK not available or error:", error?.message || "Unknown error");
    return {
      extracted_text: "",
      confidence_score: 0,
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
    // This is simplified - full implementation would parse table structure
    for (const table of document.pages[0].tables) {
      if (table.headerRows && table.bodyRows) {
        // Parse table rows
        // Implementation would extract item descriptions, quantities, prices
      }
    }
  }

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
