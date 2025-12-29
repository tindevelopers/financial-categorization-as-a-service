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

// Maximum reasonable amount for validation (matches DECIMAL(10,2) database limit)
const MAX_REASONABLE_AMOUNT = 99999999.99;

// Confidence thresholds
const HIGH_CONFIDENCE = 0.8; // Trusted extraction
const MEDIUM_CONFIDENCE = 0.5; // Review recommended
const LOW_CONFIDENCE = 0.0; // Manual review required

// Extraction method types
type ExtractionMethod = 'entity' | 'table' | 'pattern' | 'fallback';

export interface InvoiceData {
  vendor_name?: string;
  invoice_date?: string;
  invoice_number?: string;
  order_number?: string; // Order/PO number
  delivery_date?: string; // Delivery date for orders
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
  // Supplier contact information
  supplier?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: {
      street?: string;
      city?: string;
      postcode?: string;
      country?: string;
    };
    website?: string;
  };
  // OCR status flags
  ocr_configured?: boolean;
  ocr_failed?: boolean;
  ocr_error?: string;
  // Extraction metrics and confidence
  field_confidence?: Record<string, number>; // Per-field confidence scores
  extraction_methods?: Record<string, 'entity' | 'table' | 'pattern' | 'fallback'>; // Method used per field
  validation_flags?: Record<string, boolean>; // Validation results per field
  needs_review?: boolean; // Flag if any field needs manual review
  extraction_metrics?: {
    fields_extracted: number;
    fields_missing: string[];
    average_confidence: number;
    method_distribution: Record<string, number>;
  };
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
  processorType?: string;
  error?: string;
  warning?: string;
} {
  const hasProjectId = !!PROJECT_ID;
  const hasProcessorId = !!PROCESSOR_ID;
  const hasCredentials = !!(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  );
  
  const configured = hasProjectId && hasProcessorId && hasCredentials;
  
  let error: string | undefined;
  let warning: string | undefined;
  let processorType: string | undefined;
  
  if (!configured) {
    const missing: string[] = [];
    if (!hasProjectId) missing.push("GOOGLE_CLOUD_PROJECT_ID");
    if (!hasProcessorId) missing.push("GOOGLE_DOCUMENT_AI_PROCESSOR_ID");
    if (!hasCredentials) missing.push("GOOGLE_APPLICATION_CREDENTIALS");
    error = `Missing required environment variables: ${missing.join(", ")}`;
  } else {
    // Note: Processor type detection would require API call to Document AI
    // For now, we'll document recommended processor types
    // INVOICE_PROCESSOR is preferred for invoice processing
    // FORM_PARSER_PROCESSOR is generic form parser
    // OCR_PROCESSOR is basic OCR only
    processorType = "unknown"; // Would need API call to determine
    warning = "Consider using INVOICE_PROCESSOR for best invoice extraction results";
  }
  
  return {
    configured,
    provider: "google_document_ai",
    hasProjectId,
    hasProcessorId,
    hasCredentials,
    processorType,
    error,
    warning,
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
      throw new Error("No document returned from Document AI API. Check processor configuration and document format.");
    }

    // Check if we got text content
    if (!document.text || document.text.trim().length === 0) {
      console.warn("[DocumentAI] Document returned but contains no text. Document may be image-only or corrupted.");
    }

    // Parse invoice data
    let invoiceData = parseInvoiceData(document);

    // AI FALLBACK: If critical fields are still missing after all parsing attempts,
    // use AI to extract them from the raw text
    const hasCriticalFieldsMissing = 
      (!invoiceData.total && !invoiceData.subtotal) || 
      !invoiceData.vendor_name || 
      !invoiceData.invoice_number;
    
    if (hasCriticalFieldsMissing && invoiceData.extracted_text && invoiceData.extracted_text.length > 50) {
      console.log('[DocumentAI] Critical fields missing, attempting AI fallback extraction');
      try {
        const { extractFieldsWithAI, mergeWithExistingData } = await import('./ai-field-extraction');
        const aiResult = await extractFieldsWithAI(invoiceData.extracted_text, {
          vendor_name: invoiceData.vendor_name || undefined,
          invoice_number: invoiceData.invoice_number || undefined,
          invoice_date: invoiceData.invoice_date || undefined,
          total_amount: invoiceData.total || undefined,
          subtotal: invoiceData.subtotal || undefined,
          tax_amount: invoiceData.tax || undefined,
          currency: invoiceData.currency as "GBP" | "EUR" | "USD" | undefined,
        });
        
        if (aiResult) {
          invoiceData = mergeWithExistingData(invoiceData, aiResult);
          console.log('[DocumentAI] AI fallback extraction completed', {
            aiConfidence: aiResult.confidence,
            filledVendor: !!aiResult.vendor_name,
            filledTotal: aiResult.total_amount !== null,
            filledInvoiceNumber: !!aiResult.invoice_number,
          });
        }
      } catch (aiError: any) {
        console.warn('[DocumentAI] AI fallback failed:', aiError.message);
        // Continue without AI fallback - still use pattern-extracted data
      }
    }

    // Mark as successfully processed
    invoiceData.ocr_configured = true;
    invoiceData.ocr_failed = false;
    
    // Log extraction summary
    console.log("[DocumentAI] Extraction completed", {
      filename,
      hasVendor: !!invoiceData.vendor_name,
      hasInvoiceNumber: !!invoiceData.invoice_number,
      hasDate: !!invoiceData.invoice_date,
      hasTotal: invoiceData.total !== undefined,
      hasLineItems: (invoiceData.line_items?.length || 0) > 0,
      confidence: invoiceData.confidence_score,
      needsReview: invoiceData.needs_review,
      extractionMethods: invoiceData.extraction_methods,
    });

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
    field_confidence: {},
    extraction_methods: {},
    validation_flags: {},
  };

  // Extract page-level confidence
  let pageConfidences: number[] = [];
  if (document.pages) {
    document.pages.forEach((page: any) => {
      if (page.confidence !== undefined && page.confidence !== null) {
        pageConfidences.push(page.confidence);
      }
    });
  }

  // Parse entities from Document AI response
  if (document.entities) {
    for (const entity of document.entities) {
      const type = entity.type?.toLowerCase();
      const value = entity.normalizedValue?.textValue || entity.mentionText;
      const entityConfidence = entity.confidence !== undefined && entity.confidence !== null 
        ? entity.confidence 
        : (pageConfidences.length > 0 ? pageConfidences.reduce((a, b) => a + b, 0) / pageConfidences.length : 0.8);

      switch (type) {
        case "supplier_name":
        case "vendor_name":
        case "merchant_name":
          data.vendor_name = value;
          data.field_confidence!['vendor_name'] = entityConfidence;
          data.extraction_methods!['vendor_name'] = 'entity';
          break;
        case "invoice_date":
        case "receipt_date":
          const parsedDate = parseDate(value);
          if (parsedDate) {
            data.invoice_date = parsedDate;
            data.field_confidence!['invoice_date'] = entityConfidence;
            data.extraction_methods!['invoice_date'] = 'entity';
          }
          break;
        case "invoice_id":
        case "invoice_number":
          data.invoice_number = value;
          data.field_confidence!['invoice_number'] = entityConfidence;
          data.extraction_methods!['invoice_number'] = 'entity';
          break;
        case "net_amount":
        case "subtotal":
          const parsedSubtotal = parseAmount(value);
          if (parsedSubtotal !== undefined) {
            data.subtotal = parsedSubtotal;
            data.field_confidence!['subtotal'] = entityConfidence;
            data.extraction_methods!['subtotal'] = 'entity';
          }
          break;
        case "tax_amount":
          const parsedTax = parseAmount(value);
          if (parsedTax !== undefined) {
            data.tax = parsedTax;
            data.field_confidence!['tax'] = entityConfidence;
            data.extraction_methods!['tax'] = 'entity';
          }
          break;
        case "total_amount":
        case "total":
          const parsedTotal = parseAmount(value);
          if (parsedTotal !== undefined) {
            data.total = parsedTotal;
            data.field_confidence!['total'] = entityConfidence;
            data.extraction_methods!['total'] = 'entity';
          }
          break;
        case "currency":
          data.currency = value?.toUpperCase() || "USD";
          data.field_confidence!['currency'] = entityConfidence;
          data.extraction_methods!['currency'] = 'entity';
          break;
      }
    }
  }

  // Parse line items from tables if available
  if (document.pages && document.pages[0]?.tables) {
    data.line_items = [];
    // Extract table confidence
    let tableConfidences: number[] = [];
    
    // Detect Amazon invoice format from text
    const isAmazonInvoice = (document.text || "").includes('amazon') || 
                           (document.text || "").includes('Amazon EU') || 
                           (document.text || "").match(/order\s*#:\s*\d{3}-\d{7}-\d{7}/i) ||
                           (document.text || "").includes('ASIN:');
    
    // Extract line items from tables
    for (const table of document.pages[0].tables) {
      if (table.confidence !== undefined && table.confidence !== null) {
        tableConfidences.push(table.confidence);
      }
      // Handle tables with or without explicit header rows
      const bodyRows = table.bodyRows || [];
      const headerRows = table.headerRows || [];
      const allRows = [...headerRows, ...bodyRows];
      
      // Detect Amazon table format by checking headers
      let isAmazonTable = false;
      if (headerRows.length > 0) {
        const headerText = headerRows[0].cells?.map((c: any) => c?.text || '').join(' ').toLowerCase() || '';
        isAmazonTable = headerText.includes('unit price (incl. vat)') || 
                       headerText.includes('item subtotal (incl. vat)') ||
                       headerText.includes('asin');
      }
      
      // Skip header rows when processing
      const rowsToProcess = headerRows.length > 0 ? bodyRows : allRows;
      
      for (const row of rowsToProcess) {
        const cells = row.cells || [];
        if (cells.length < 2) continue;
        
        // Skip summary rows (contain "total", "subtotal", "vat", etc.)
        const rowText = cells.map((c: any) => c?.text || '').join(' ').toLowerCase();
        if (rowText.match(/\b(total|subtotal|vat|tax|sub\s*total|delivery|shipping|shipping charges)\b/)) {
          continue;
        }
        
        // AMAZON TABLE FORMAT PARSING
        // Amazon format: [Description, Qty, Unit price (excl. VAT), VAT rate, Unit price (incl. VAT), Item subtotal (incl. VAT)]
        if (isAmazonTable || isAmazonInvoice) {
          let description = "";
          let quantity: number | undefined;
          let unitPrice: number | undefined;
          let total: number | undefined;
          let asin: string | undefined;
          
          // Description is usually first column
          if (cells[0]?.text) {
            description = cells[0].text.trim();
            // Extract ASIN if present in description: "ASIN: B0CJY33X7Q"
            const asinMatch = description.match(/asin[:\s]+([A-Z0-9]{10})/i);
            if (asinMatch) {
              asin = asinMatch[1];
              // Remove ASIN from description
              description = description.replace(/asin[:\s]+[A-Z0-9]{10}/i, '').trim();
            }
          }
          
          // Quantity is usually second column (or can be in description)
          if (cells[1]?.text) {
            const qtyText = cells[1].text.trim();
            const qtyValue = parseFloat(qtyText);
            if (!isNaN(qtyValue) && qtyValue > 0 && qtyValue < 1000 && qtyValue === Math.floor(qtyValue)) {
              quantity = qtyValue;
            }
          }
          
          // Try to find "Item subtotal (incl. VAT)" - this is the total for the line item
          // Usually the last column or second-to-last
          for (let i = cells.length - 1; i >= Math.max(0, cells.length - 3); i--) {
            const cellText = (cells[i]?.text || "").trim();
            const amount = parseAmount(cellText);
            if (amount !== undefined && amount > 0 && amount <= MAX_REASONABLE_AMOUNT) {
              total = amount;
              break;
            }
          }
          
          // Unit price (incl. VAT) is usually second-to-last column
          if (cells.length >= 5 && cells[cells.length - 2]?.text) {
            const unitPriceText = cells[cells.length - 2].text.trim();
            const unitPriceAmount = parseAmount(unitPriceText);
            if (unitPriceAmount !== undefined && unitPriceAmount > 0 && unitPriceAmount <= MAX_REASONABLE_AMOUNT) {
              unitPrice = unitPriceAmount;
            }
          }
          
          // Only add if we have description and total
          if (description && description.length > 3 && total !== undefined && total > 0) {
            data.line_items!.push({
              description: description.trim(),
              quantity,
              unit_price: unitPrice,
              total,
            });
            continue; // Skip generic parsing for this row
          }
        }
        
        // GENERIC TABLE PARSING (for non-Amazon invoices)
        // Try to extract description, quantity, unit price, and total
        let description = "";
        let quantity: number | undefined;
        let unitPrice: number | undefined;
        let total: number | undefined;

        // Common table structures:
        // [Description, Qty, Unit Price, Total]
        // [Description, Amount]
        // [Item, Price]
        // [Quantity x Description - Price] (Screwfix format)
        for (let i = 0; i < cells.length; i++) {
          const cellText = (cells[i]?.text || "").trim();
          if (!cellText) continue;
          
          const cellTextLower = cellText.toLowerCase();

          // Check for Screwfix format variations in cell:
          // "4 x Vapour Barrier Membrane 10m x 2m - £59.96"
          // "4 x Vapour Barrier Membrane 10m x 2m £59.96"
          const screwfixPatterns = [
            /^(\d+)\s*x\s+(.+?)\s*[-–]\s*([£$€]?\s*\d+[\d.,]*)/i,
            /^(\d+)\s*x\s+(.+?)\s+([£$€]\s*\d+[\d.,]*)/i,
          ];
          
          for (const pattern of screwfixPatterns) {
            const screwfixMatch = cellText.match(pattern);
            if (screwfixMatch) {
              quantity = parseFloat(screwfixMatch[1]);
              description = screwfixMatch[2].trim();
              total = parseAmount(screwfixMatch[3]);
              if (total !== undefined && quantity > 0 && description.length > 3) {
                unitPrice = total / quantity;
                break; // Found complete line item in this cell
              }
            }
          }
          
          if (description && total !== undefined) break; // Already found complete item

          // Description is usually the first column or contains text (not just numbers)
          if (i === 0 && cellText && !parseAmount(cellText)) {
            description = cellText.trim();
            
            // Check if description contains quantity pattern: "4 x Item Name"
            const qtyPattern = /^(\d+)\s*x\s+(.+)/i;
            const qtyMatch = description.match(qtyPattern);
            if (qtyMatch) {
              quantity = parseFloat(qtyMatch[1]);
              description = qtyMatch[2].trim();
            }
          }

          // Try to identify amounts (monetary values)
          const amount = parseAmount(cellText);
          if (amount !== undefined && amount > 0 && amount <= MAX_REASONABLE_AMOUNT) {
            // If this looks like a quantity (small integer), don't treat as amount
            if (cellText.match(/^\d+$/) && amount < 1000 && amount === Math.floor(amount)) {
              quantity = amount;
            } else {
              // This is likely a monetary amount
              if (total === undefined) {
                total = amount;
              } else if (unitPrice === undefined && cells.length > 2) {
                // If we already have a total and there are multiple amount columns,
                // the smaller one might be unit price
                if (amount < total) {
                  unitPrice = amount;
                } else {
                  total = amount; // Use the larger amount as total
                }
              }
            }
          }

          // Quantity is usually a small integer in its own cell
          if (cellText.match(/^\d+$/) && parseFloat(cellText) < 1000 && parseFloat(cellText) > 0) {
            const qtyValue = parseFloat(cellText);
            if (qtyValue === Math.floor(qtyValue)) {
              quantity = qtyValue;
            }
          }
        }

        // Only add if we have at least description and total
        if (description && description.length > 3 && total !== undefined && total > 0) {
          data.line_items!.push({
            description,
            quantity,
            unit_price: unitPrice,
            total,
          });
        }
      }
    }
    // Track that line items came from tables
    if (data.line_items && data.line_items.length > 0) {
      const avgTableConfidence = tableConfidences.length > 0
        ? tableConfidences.reduce((a, b) => a + b, 0) / tableConfidences.length
        : 0.8;
      data.field_confidence!['line_items'] = avgTableConfidence;
      data.extraction_methods!['line_items'] = 'table';
    }
  }
  
  // Also parse line items from plain text if not found in tables
  // This helps with invoices that don't have structured tables
  if (!data.line_items || data.line_items.length === 0) {
    data.line_items = [];
    const text = document.text || "";
    const lines = text.split('\n');
    let patternExtractedCount = 0;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Screwfix format variations:
      // "4 x Vapour Barrier Membrane 10m x 2m - £59.96"
      // "4 x Vapour Barrier Membrane 10m x 2m £59.96" (no dash)
      // "4 x Vapour Barrier Membrane 10m x 2m" followed by amount on same or next line
      const screwfixPatterns = [
        /^(\d+)\s*x\s+(.+?)\s*[-–]\s*([£$€]?\s*\d+[\d.,]*)/i, // With dash
        /^(\d+)\s*x\s+(.+?)\s+([£$€]\s*\d+[\d.,]*)/i, // Without dash, currency symbol
        /^(\d+)\s*x\s+(.+?)\s+(\d+[\d.,]*)\s*[£$€]?/i, // Amount at end
      ];
      
      let matched = false;
      for (const pattern of screwfixPatterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
          const quantity = parseFloat(match[1]);
          const description = match[2].trim();
          const total = parseAmount(match[3]);
          if (total !== undefined && description.length > 3 && total > 0) {
            data.line_items.push({
              description,
              quantity: quantity > 0 ? quantity : undefined,
              unit_price: quantity > 0 && total ? total / quantity : undefined,
              total,
            });
            patternExtractedCount++;
            matched = true;
            break;
          }
        }
      }
      
      // If no Screwfix pattern matched, try generic line item patterns
      if (!matched) {
        // Pattern: Description followed by amount
        // Look for lines that have text followed by a monetary amount
        const genericPattern = /^(.+?)\s+([£$€]?\s*\d+[\d.,]*)\s*$/i;
        const genericMatch = trimmedLine.match(genericPattern);
        if (genericMatch) {
          const description = genericMatch[1].trim();
          const total = parseAmount(genericMatch[2]);
          // Skip if it looks like a header or summary line
          const isSummaryLine = /^(total|subtotal|vat|tax|sub\s*total|delivery|shipping)/i.test(description);
          if (!isSummaryLine && total !== undefined && total > 0 && description.length > 3) {
            // Check if description contains quantity
            const qtyMatch = description.match(/^(\d+)\s*x\s+(.+)/i);
            if (qtyMatch) {
              const quantity = parseFloat(qtyMatch[1]);
              const itemDescription = qtyMatch[2].trim();
              data.line_items.push({
                description: itemDescription,
                quantity: quantity > 0 ? quantity : undefined,
                unit_price: quantity > 0 && total ? total / quantity : undefined,
                total,
              });
              patternExtractedCount++;
            } else {
              data.line_items.push({
                description,
                total,
              });
              patternExtractedCount++;
            }
          }
        }
      }
    }
    // Track that line items came from pattern matching
    if (patternExtractedCount > 0) {
      data.field_confidence!['line_items'] = 0.6; // Pattern-based, lower confidence
      data.extraction_methods!['line_items'] = 'pattern';
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

  // Enhanced text parsing for supplier information and additional fields
  // This helps extract data that Document AI might miss
  if (document.text) {
    const text = document.text;
    
    // Extract amounts from text patterns (fallback if entities don't work)
    // This is critical for PDFs where structured extraction fails
    if (!data.total || !data.subtotal || !data.tax) {
      const foundAmounts: Array<{ type: string; amount: number; line: string }> = [];
      
      // Common patterns for totals, subtotals, VAT, etc.
      const amountPatterns = [
        // Total (inc. VAT): £59.96 or Total (inc. VAT) | £59.96
        {
          pattern: /total\s*\(inc\.?\s*vat\)[:\s|]*([£$€]?\s*\d+[\d.,]*)/gi,
          type: 'total_inc_vat',
          priority: 1
        },
        // Total (ex. VAT): £49.97
        {
          pattern: /total\s*\(ex\.?\s*vat\)[:\s|]*([£$€]?\s*\d+[\d.,]*)/gi,
          type: 'total_ex_vat',
          priority: 2
        },
        // Sub total (inc. VAT): £59.96
        {
          pattern: /sub\s*total\s*\(inc\.?\s*vat\)[:\s|]*([£$€]?\s*\d+[\d.,]*)/gi,
          type: 'subtotal_inc_vat',
          priority: 3
        },
        // Sub total (ex. VAT): £49.97
        {
          pattern: /sub\s*total\s*\(ex\.?\s*vat\)[:\s|]*([£$€]?\s*\d+[\d.,]*)/gi,
          type: 'subtotal_ex_vat',
          priority: 4
        },
        // Sub total: £59.96
        {
          pattern: /sub\s*total[:\s|]+([£$€]?\s*\d+[\d.,]*)/gi,
          type: 'subtotal',
          priority: 5
        },
        // VAT: £9.99 or Tax: £9.99
        {
          pattern: /(?:vat|tax)\s*[:\s|]+([£$€]?\s*\d+[\d.,]*)/gi,
          type: 'vat',
          priority: 6
        },
        // Total: £59.96 (generic fallback)
        {
          pattern: /^total[:\s|]+([£$€]?\s*\d+[\d.,]*)/gim,
          type: 'total',
          priority: 7
        },
      ];
      
      // Scan text for all amount patterns
      for (const { pattern, type, priority } of amountPatterns) {
        const matches = Array.from(text.matchAll(pattern)) as RegExpMatchArray[];
        for (const match of matches) {
          const amountStr = match[1]?.trim();
          if (amountStr) {
            const amount = parseAmount(amountStr);
            if (amount !== undefined && amount > 0) {
              foundAmounts.push({
                type,
                amount,
                line: match[0] || ''
              });
            }
          }
        }
      }
      
      // Process found amounts based on priority and type
      // Sort by priority (lower number = higher priority)
      foundAmounts.sort((a, b) => {
        const aPriority = amountPatterns.find(p => p.type === a.type)?.priority || 999;
        const bPriority = amountPatterns.find(p => p.type === b.type)?.priority || 999;
        return aPriority - bPriority;
      });
      
      // Assign amounts based on what we found
      for (const found of foundAmounts) {
        if (found.type === 'total_inc_vat' && !data.total) {
          data.total = found.amount;
          data.field_confidence!['total'] = 0.7; // Pattern-based extraction, moderate confidence
          data.extraction_methods!['total'] = 'pattern';
        } else if (found.type === 'total_ex_vat' && !data.total) {
          data.total = found.amount;
          data.field_confidence!['total'] = 0.7;
          data.extraction_methods!['total'] = 'pattern';
        } else if (found.type === 'total' && !data.total) {
          data.total = found.amount;
          data.field_confidence!['total'] = 0.7;
          data.extraction_methods!['total'] = 'pattern';
        } else if (found.type === 'subtotal_inc_vat' && !data.subtotal) {
          data.subtotal = found.amount;
          data.field_confidence!['subtotal'] = 0.7;
          data.extraction_methods!['subtotal'] = 'pattern';
        } else if (found.type === 'subtotal_ex_vat' && !data.subtotal) {
          data.subtotal = found.amount;
          data.field_confidence!['subtotal'] = 0.7;
          data.extraction_methods!['subtotal'] = 'pattern';
        } else if (found.type === 'subtotal' && !data.subtotal) {
          data.subtotal = found.amount;
          data.field_confidence!['subtotal'] = 0.7;
          data.extraction_methods!['subtotal'] = 'pattern';
        } else if (found.type === 'vat' && !data.tax) {
          data.tax = found.amount;
          data.field_confidence!['tax'] = 0.7;
          data.extraction_methods!['tax'] = 'pattern';
        }
      }
      
      // If we found total but not subtotal, and we have VAT, calculate subtotal
      if (data.total && data.tax && !data.subtotal) {
        data.subtotal = data.total - data.tax;
      }
      
      // If we found subtotal and VAT but not total, calculate total
      if (data.subtotal && data.tax && !data.total) {
        data.total = data.subtotal + data.tax;
      }
    }
    
    // Fallback: If structured extraction failed, scan entire text for amounts
    // This is a last resort when entities and patterns don't work
    if (!data.total && !data.subtotal && !data.tax && text) {
      // Find all monetary amounts in the text
      // Improved regex: look for amounts with currency symbols or reasonable decimal patterns
      // Avoid matching dates, reference numbers, etc.
      const amountRegex = /([£$€]\s*\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{2})?|\d{1,6}[.,]\d{2}(?:\s*[£$€])?)/g;
      const allAmounts: Array<{ amount: number; context: string; position: number }> = [];
      
      let match: RegExpExecArray | null;
      while ((match = amountRegex.exec(text)) !== null) {
        const amountStr = match[1]?.trim();
        if (amountStr) {
          const amount = parseAmount(amountStr);
          // Only accept reasonable amounts (between 0.01 and MAX_REASONABLE_AMOUNT)
          if (amount !== undefined && amount > 0 && amount <= MAX_REASONABLE_AMOUNT) {
            // Get context around the amount (50 chars before and after)
            const start = Math.max(0, match.index - 50);
            const end = Math.min(text.length, match.index + match[0].length + 50);
            const context = text.substring(start, end).toLowerCase();
            
            // Skip if context suggests this is not a monetary amount
            // (e.g., dates, reference numbers, phone numbers)
            if (context.match(/\b(date|phone|ref|reference|order\s*#|invoice\s*#)\b/i)) {
              continue;
            }
            
            allAmounts.push({
              amount,
              context,
              position: match.index
            });
          }
        }
      }
      
      // Remove duplicates (same amount appearing multiple times)
      const uniqueAmounts = Array.from(
        new Map(allAmounts.map(item => [item.amount, item])).values()
      );
      
      // Sort by amount (descending) - largest is likely the total
      uniqueAmounts.sort((a, b) => b.amount - a.amount);
      
      // Try to identify amounts based on context keywords
      for (const item of uniqueAmounts) {
        const context = item.context;
        
        // Check for total keywords
        if (!data.total && (
          context.includes('total') ||
          context.includes('grand total') ||
          context.includes('amount due') ||
          context.includes('balance')
        )) {
          data.total = item.amount;
          continue;
        }
        
        // Check for subtotal keywords
        if (!data.subtotal && (
          context.includes('subtotal') ||
          context.includes('sub total') ||
          context.includes('net amount')
        )) {
          data.subtotal = item.amount;
          continue;
        }
        
        // Check for VAT/tax keywords
        if (!data.tax && (
          context.includes('vat') ||
          context.includes('tax') ||
          context.includes('gst') ||
          context.includes('sales tax')
        )) {
          data.tax = item.amount;
          continue;
        }
      }
      
      // If we still don't have a total but have amounts, use the largest
      if (!data.total && uniqueAmounts.length > 0) {
        // Use the largest amount as total, but avoid very small amounts (< 1)
        const largestAmount = uniqueAmounts.find(a => a.amount >= 1);
        if (largestAmount) {
          data.total = largestAmount.amount;
          data.field_confidence!['total'] = 0.5; // Fallback extraction, lower confidence
          data.extraction_methods!['total'] = 'fallback';
        }
      }
      
      // If we have total but not subtotal, and we found VAT, calculate subtotal
      if (data.total && data.tax && !data.subtotal) {
        data.subtotal = data.total - data.tax;
      }
    }
    
    // Extract invoice number from text (fallback if entities didn't work)
    if (!data.invoice_number) {
      const invoiceNumberPatterns = [
        /invoice\s*(?:number|#|no\.?)[:\s]+([A-Z0-9\-]+)/i,
        /invoice\s*id[:\s]+([A-Z0-9\-]+)/i,
        /invoice[:\s]+([A-Z]{2,}-\d{4}-\d+)/i, // Pattern like LD-2024-1000105683
        /^invoice\s+([A-Z0-9\-]+)/im,
        /(?:invoice|inv)\.?\s*#?\s*([A-Z0-9\-]{5,})/i,
      ];
      for (const pattern of invoiceNumberPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          data.invoice_number = match[1].trim();
          data.field_confidence!['invoice_number'] = 0.7;
          data.extraction_methods!['invoice_number'] = 'pattern';
          break;
        }
      }
    }
    
    // Extract invoice date from text (fallback if entities didn't work)
    if (!data.invoice_date) {
      const invoiceDatePatterns = [
        /invoice\s*date[:\s]+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
        /invoice\s*date[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /date[:\s]+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
        /dated[:\s]+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
      ];
      for (const pattern of invoiceDatePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const parsedDate = parseDate(match[1]);
          if (parsedDate) {
            data.invoice_date = parsedDate;
            data.field_confidence!['invoice_date'] = 0.7;
            data.extraction_methods!['invoice_date'] = 'pattern';
            break;
          }
        }
      }
    }
    
    // Extract vendor name from text (fallback if entities didn't work)
    if (!data.vendor_name) {
      // Look for vendor name patterns near the top of the document
      const vendorPatterns = [
        /^(?:from|vendor|supplier|merchant)[:\s]+(.+?)(?:\n|$)/im,
        /^([A-Z][A-Z\s&]+(?:LTD|LIMITED|INC|LLC|CORP|CORPORATION|LLP|PLC))(?:\n|$)/m,
      ];
      for (const pattern of vendorPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const vendorName = match[1].trim();
          if (vendorName.length > 2 && vendorName.length < 100) {
            data.vendor_name = vendorName;
            data.field_confidence!['vendor_name'] = 0.6;
            data.extraction_methods!['vendor_name'] = 'pattern';
            if (!data.supplier?.name) {
              if (!data.supplier) data.supplier = {};
              data.supplier.name = vendorName;
            }
            break;
          }
        }
      }
    }
    
    // Extract order number (common patterns: "Order Number:", "Order #", "PO Number:", etc.)
    if (!data.order_number) {
      const orderPatterns = [
        /order\s*(?:number|#|no\.?):\s*([A-Z0-9\-]+)/i,
        /order\s*id[:\s]+([A-Z0-9\-]+)/i,
        /po\s*(?:number|#|no\.?):\s*([A-Z0-9\-]+)/i,
        /purchase\s*order[:\s]+([A-Z0-9\-]+)/i,
        // Amazon format: Order #: 203-7525121-4700369
        /order\s*#:\s*(\d{3}-\d{7}-\d{7})/i,
      ];
      for (const pattern of orderPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          data.order_number = match[1].trim();
          break;
        }
      }
    }
    
    // AMAZON INVOICE SPECIFIC PARSING
    // Detect if this is an Amazon invoice
    const isAmazonInvoice = text.includes('amazon') || 
                           text.includes('Amazon EU') || 
                           text.match(/order\s*#:\s*\d{3}-\d{7}-\d{7}/i) ||
                           text.includes('ASIN:');
    
    if (isAmazonInvoice) {
      console.log('[DocumentAI] Detected Amazon invoice format, applying Amazon-specific parsing');
      
      // Extract "Sold by" vendor name (Amazon invoices)
      if (!data.vendor_name) {
        const soldByPatterns = [
          /sold\s*by[:\s]+(.+?)(?:\n|$)/im,
          /sold\s*by[:\s]+(.+?)(?:\n|VAT|Address)/im,
        ];
        for (const pattern of soldByPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            const vendorName = match[1].trim().split('\n')[0].trim();
            if (vendorName.length > 2 && vendorName.length < 200) {
              data.vendor_name = vendorName;
              data.field_confidence!['vendor_name'] = 0.85; // High confidence for Amazon format
              data.extraction_methods!['vendor_name'] = 'pattern';
              if (!data.supplier) data.supplier = {};
              data.supplier.name = vendorName;
              break;
            }
          }
        }
      }
      
      // Extract Amazon invoice total explicitly
      // Pattern: "Invoice total: £89.54" or "Invoice total £89.54"
      if (!data.total) {
        const amazonTotalPatterns = [
          /invoice\s*total[:\s]+([£$€]?\s*\d+[\d.,]*)/i,
          /invoice\s*total\s*\(incl\.?\s*vat\)[:\s]+([£$€]?\s*\d+[\d.,]*)/i,
        ];
        for (const pattern of amazonTotalPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            const amount = parseAmount(match[1]);
            if (amount !== undefined && amount > 0 && amount <= MAX_REASONABLE_AMOUNT) {
              data.total = amount;
              data.field_confidence!['total'] = 0.9; // High confidence for explicit "Invoice total"
              data.extraction_methods!['total'] = 'pattern';
              break;
            }
          }
        }
      }
      
      // Extract VAT breakdown from Amazon format
      // Pattern: "VAT rate: 20%" followed by "VAT subtotal: £14.92"
      if (!data.tax) {
        const vatSubtotalPattern = /vat\s*subtotal[:\s]+([£$€]?\s*\d+[\d.,]*)/i;
        const vatMatch = text.match(vatSubtotalPattern);
        if (vatMatch && vatMatch[1]) {
          const taxAmount = parseAmount(vatMatch[1]);
          if (taxAmount !== undefined && taxAmount > 0 && taxAmount <= MAX_REASONABLE_AMOUNT) {
            data.tax = taxAmount;
            data.field_confidence!['tax'] = 0.85;
            data.extraction_methods!['tax'] = 'pattern';
          }
        }
      }
      
      // Extract subtotal (excl. VAT) from Amazon format
      // Pattern: "Item subtotal (excl. VAT): £74.62"
      if (!data.subtotal) {
        const subtotalExVatPattern = /item\s*subtotal\s*\(excl\.?\s*vat\)[:\s]+([£$€]?\s*\d+[\d.,]*)/i;
        const subtotalMatch = text.match(subtotalExVatPattern);
        if (subtotalMatch && subtotalMatch[1]) {
          const subtotalAmount = parseAmount(subtotalMatch[1]);
          if (subtotalAmount !== undefined && subtotalAmount > 0 && subtotalAmount <= MAX_REASONABLE_AMOUNT) {
            data.subtotal = subtotalAmount;
            data.field_confidence!['subtotal'] = 0.85;
            data.extraction_methods!['subtotal'] = 'pattern';
          }
        }
      }
      
      // Extract order date from Amazon format
      // Pattern: "Order date: 03 September 2024"
      if (!data.invoice_date) {
        const amazonDatePattern = /order\s*date[:\s]+(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i;
        const dateMatch = text.match(amazonDatePattern);
        if (dateMatch && dateMatch[1]) {
          const parsedDate = parseDate(dateMatch[1]);
          if (parsedDate) {
            data.invoice_date = parsedDate;
            data.field_confidence!['invoice_date'] = 0.85;
            data.extraction_methods!['invoice_date'] = 'pattern';
          }
        }
      }
      
      // Extract order number as invoice number if invoice number not found
      if (!data.invoice_number && data.order_number) {
        data.invoice_number = data.order_number;
        data.field_confidence!['invoice_number'] = 0.8;
        data.extraction_methods!['invoice_number'] = 'pattern';
      }
    }
    
    // LODGIFY/SAAS INVOICE PARSING
    // Detect SaaS subscription invoices (Lodgify, Stripe, etc.)
    const isLodgifyInvoice = text.includes('LODGIFY') || 
                            text.includes('Lodgify') ||
                            text.match(/Invoice\s*#\s*LD-\d{4}-\d+/i);
    
    if (isLodgifyInvoice) {
      console.log('[DocumentAI] Detected Lodgify/SaaS invoice format');
      
      // Extract Lodgify invoice number (format: LD-2024-1000105683)
      if (!data.invoice_number) {
        const lodgifyInvoicePattern = /Invoice\s*#\s*(LD-\d{4}-\d+)/i;
        const invoiceMatch = text.match(lodgifyInvoicePattern);
        if (invoiceMatch && invoiceMatch[1]) {
          data.invoice_number = invoiceMatch[1].trim();
          data.field_confidence!['invoice_number'] = 0.95;
          data.extraction_methods!['invoice_number'] = 'pattern';
        }
      }
      
      // Extract Invoice Amount (format: "Invoice Amount €63.98 (EUR)")
      if (!data.total) {
        const invoiceAmountPatterns = [
          /Invoice\s*Amount\s*([€£$]?\s*[\d,]+\.?\d*)\s*\(?(EUR|GBP|USD)?\)?/i,
          /Invoice\s*Amount[:\s]+([€£$]?\s*[\d,]+\.?\d*)/i,
        ];
        for (const pattern of invoiceAmountPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            const amount = parseAmount(match[1]);
            if (amount !== undefined && amount > 0 && amount <= MAX_REASONABLE_AMOUNT) {
              data.total = amount;
              data.field_confidence!['total'] = 0.95;
              data.extraction_methods!['total'] = 'pattern';
              if (match[2]) {
                data.currency = match[2].toUpperCase();
              }
              break;
            }
          }
        }
      }
      
      // Extract Invoice Date (format: "Invoice Date Aug 27, 2024" or "Invoice Date Oct 01, 2024")
      if (!data.invoice_date) {
        const lodgifyDatePattern = /Invoice\s*Date\s+(\w+\s+\d{1,2},?\s+\d{4})/i;
        const dateMatch = text.match(lodgifyDatePattern);
        if (dateMatch && dateMatch[1]) {
          const parsedDate = parseDate(dateMatch[1]);
          if (parsedDate) {
            data.invoice_date = parsedDate;
            data.field_confidence!['invoice_date'] = 0.95;
            data.extraction_methods!['invoice_date'] = 'pattern';
          }
        }
      }
      
      // Set vendor name to Lodgify
      if (!data.vendor_name) {
        data.vendor_name = 'Lodgify';
        data.field_confidence!['vendor_name'] = 0.95;
        data.extraction_methods!['vendor_name'] = 'pattern';
        if (!data.supplier) data.supplier = {};
        data.supplier.name = 'Lodgify';
      }
      
      // Extract currency from EUR/GBP/USD patterns
      if (!data.currency) {
        if (text.includes('EUR') || text.includes('€')) data.currency = 'EUR';
        else if (text.includes('GBP') || text.includes('£')) data.currency = 'GBP';
        else data.currency = 'USD';
      }
    }
    
    // UTILITY BILL PARSING (British Gas, EDF, Scottish Power, etc.)
    const isUtilityBill = text.match(/\b(British Gas|EDF|Scottish Power|Octopus|E\.ON|SSE|Npower|OVO)\b/i) ||
                         text.match(/\b(electricity|gas|energy)\s+bill\b/i) ||
                         text.match(/\bBill\s*(?:date|number)\b/i);
    
    if (isUtilityBill) {
      console.log('[DocumentAI] Detected utility bill format');
      
      // Extract bill number (format: "Bill number: 827262908")
      if (!data.invoice_number) {
        const billNumberPatterns = [
          /Bill\s*number[:\s]+(\d+)/i,
          /Account\s*number[:\s]+(\d+)/i,
        ];
        for (const pattern of billNumberPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            data.invoice_number = match[1].trim();
            data.field_confidence!['invoice_number'] = 0.9;
            data.extraction_methods!['invoice_number'] = 'pattern';
            break;
          }
        }
      }
      
      // Extract bill date (format: "Bill date: 20 October 2023")
      if (!data.invoice_date) {
        const billDatePatterns = [
          /Bill\s*date[:\s]+(\d{1,2}\s+\w+\s+\d{4})/i,
          /Bill\s*date[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        ];
        for (const pattern of billDatePatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            const parsedDate = parseDate(match[1]);
            if (parsedDate) {
              data.invoice_date = parsedDate;
              data.field_confidence!['invoice_date'] = 0.9;
              data.extraction_methods!['invoice_date'] = 'pattern';
              break;
            }
          }
        }
      }
      
      // Extract total amount due (format: "Total amount due £1,429.22")
      if (!data.total) {
        const utilityTotalPatterns = [
          /Total\s*amount\s*due[:\s]*([£$€]?\s*[\d,]+\.?\d*)/i,
          /Amount\s*due[:\s]*([£$€]?\s*[\d,]+\.?\d*)/i,
          /Please\s*pay\s*(?:this\s*)?(?:by[^£$€\d]*)?([£$€]\s*[\d,]+\.?\d*)/i,
        ];
        for (const pattern of utilityTotalPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            const amount = parseAmount(match[1]);
            if (amount !== undefined && amount > 0 && amount <= MAX_REASONABLE_AMOUNT) {
              data.total = amount;
              data.field_confidence!['total'] = 0.9;
              data.extraction_methods!['total'] = 'pattern';
              break;
            }
          }
        }
      }
      
      // Extract new charges (format: "Total new charges this bill inc VAT £310.61")
      if (!data.subtotal) {
        const newChargesPatterns = [
          /(?:Total\s*)?new\s*charges\s*(?:this\s*bill\s*)?(?:inc\.?\s*VAT)?[:\s]*([£$€]?\s*[\d,]+\.?\d*)/i,
          /Total\s*charges\s*exc\.?\s*VAT[:\s]*([£$€]?\s*[\d,]+\.?\d*)/i,
        ];
        for (const pattern of newChargesPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            const amount = parseAmount(match[1]);
            if (amount !== undefined && amount > 0 && amount <= MAX_REASONABLE_AMOUNT) {
              data.subtotal = amount;
              data.field_confidence!['subtotal'] = 0.85;
              data.extraction_methods!['subtotal'] = 'pattern';
              break;
            }
          }
        }
      }
      
      // Extract vendor name from utility provider
      if (!data.vendor_name) {
        const utilityVendorPatterns = [
          /\b(British Gas)\b/i,
          /\b(EDF Energy)\b/i,
          /\b(Scottish Power)\b/i,
          /\b(Octopus Energy)\b/i,
          /\b(E\.ON)\b/i,
          /\b(SSE)\b/i,
          /\b(Npower)\b/i,
          /\b(OVO Energy)\b/i,
        ];
        for (const pattern of utilityVendorPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            data.vendor_name = match[1].trim();
            data.field_confidence!['vendor_name'] = 0.95;
            data.extraction_methods!['vendor_name'] = 'pattern';
            if (!data.supplier) data.supplier = {};
            data.supplier.name = data.vendor_name;
            break;
          }
        }
      }
      
      // Set currency to GBP for UK utility bills
      if (!data.currency && text.includes('£')) {
        data.currency = 'GBP';
      }
    }
    
    // GENERIC UK INVOICE PARSING
    // For invoices with UK-specific formats (DD/MM/YYYY dates, £ currency)
    const isUKInvoice = text.match(/\bVAT\s*(?:Registration\s*)?(?:Number|No\.?|#)?[:\s]+(?:GB)?\s*\d+/i) ||
                       text.includes('£') ||
                       text.match(/United\s*Kingdom/i);
    
    if (isUKInvoice && !data.currency) {
      data.currency = 'GBP';
    }
    
    // Try to parse DD/MM/YYYY format dates (UK format)
    if (!data.invoice_date && isUKInvoice) {
      const ukDatePatterns = [
        /(?:Invoice\s*Date|Date)[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
        /(?:Invoice\s*Date|Date)[:\s]+(\d{1,2}-\d{1,2}-\d{2,4})/i,
      ];
      for (const pattern of ukDatePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          // Parse UK format (DD/MM/YYYY)
          const parts = match[1].split(/[\/\-]/);
          if (parts.length === 3) {
            const day = parts[0];
            const month = parts[1];
            let year = parts[2];
            if (year.length === 2) {
              year = '20' + year;
            }
            const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            if (!isNaN(Date.parse(dateStr))) {
              data.invoice_date = dateStr;
              data.field_confidence!['invoice_date'] = 0.8;
              data.extraction_methods!['invoice_date'] = 'pattern';
              break;
            }
          }
        }
      }
    }
    
    // Extract delivery date
    if (!data.delivery_date) {
      const deliveryDatePatterns = [
        /delivery\s*date[:\s]+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
        /delivered[:\s]+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
        /delivery[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      ];
      for (const pattern of deliveryDatePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          data.delivery_date = parseDate(match[1]);
          break;
        }
      }
    }
    
    // Extract supplier information from text
    if (!data.supplier) {
      data.supplier = {};
    }
    
    // Extract supplier name (usually at the top of the document)
    if (!data.supplier.name && !data.vendor_name) {
      // Look for company name patterns at the start of document
      const lines = text.split('\n').slice(0, 10); // Check first 10 lines
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip common headers and labels
        if (trimmed && 
            !trimmed.match(/^(order|invoice|receipt|summary|details|payment|delivery)/i) &&
            trimmed.length > 2 && trimmed.length < 100 &&
            !trimmed.match(/^\d+[xX]\s/) && // Not a quantity line
            !trimmed.match(/^[£$€]\s*\d/) && // Not a price line
            !trimmed.match(/^\d{1,2}[\/\-]\d{1,2}/)) { // Not a date
          data.supplier.name = trimmed;
          data.vendor_name = trimmed; // Also set vendor_name for compatibility
          break;
        }
      }
    } else if (data.vendor_name && !data.supplier.name) {
      data.supplier.name = data.vendor_name;
    }
    
    // Extract email addresses
    if (!data.supplier.email) {
      const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
      const emails = text.match(emailPattern);
      if (emails && emails.length > 0) {
        // Prefer email addresses that look like supplier emails (not customer emails)
        // Usually supplier emails are in billing/payment sections
        const supplierEmail = emails.find((email: string) => 
          !email.toLowerCase().includes('cardholder') &&
          !email.toLowerCase().includes('billing') &&
          !email.toLowerCase().includes('customer')
        ) || emails[0];
        data.supplier.email = supplierEmail;
      }
    }
    
    // Extract phone numbers
    if (!data.supplier.phone) {
      const phonePatterns = [
        /(?:\+44|0)?\s*\d{2,4}\s*\d{3,4}\s*\d{3,4}/g, // UK format
        /(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, // US format
        /\d{10,}/g, // Generic 10+ digits
      ];
      for (const pattern of phonePatterns) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
          // Clean up phone number
          const phone = matches[0].replace(/[\s\-\(\)\.]/g, '').trim();
          if (phone.length >= 10) {
            data.supplier.phone = phone;
            break;
          }
        }
      }
    }
    
    // Extract address (look for postcode patterns)
    if (!data.supplier.address) {
      data.supplier.address = {};
      // UK postcode pattern
      const ukPostcodePattern = /([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})/i;
      const postcodeMatch = text.match(ukPostcodePattern);
      if (postcodeMatch) {
        data.supplier.address.postcode = postcodeMatch[1].trim().toUpperCase();
        
        // Try to extract address lines before postcode
        const postcodeIndex = text.indexOf(postcodeMatch[1]);
        const addressSection = text.substring(Math.max(0, postcodeIndex - 200), postcodeIndex);
        const addressLines: string[] = addressSection.split('\n').filter((line: string) => line.trim()).slice(-4);
        
        // Extract street, city, country
        for (let i = addressLines.length - 1; i >= 0; i--) {
          const line = addressLines[i].trim();
          if (line.match(/united\s+kingdom|uk|england|scotland|wales/i)) {
            data.supplier.address.country = 'United Kingdom';
          } else if (!data.supplier.address.city && line.length > 2 && line.length < 50) {
            data.supplier.address.city = line;
          } else if (!data.supplier.address.street && line.length > 5) {
            data.supplier.address.street = line;
          }
        }
      }
    }
    
    // Extract website (look for URLs)
    if (!data.supplier.website) {
      const urlPattern = /(https?:\/\/[^\s]+)/gi;
      const urls = text.match(urlPattern);
      if (urls && urls.length > 0) {
        // Prefer www. or main domain, not email links
        const website = urls.find((url: string) => 
          !url.includes('mailto:') && 
          (url.includes('www.') || url.match(/https?:\/\/([^\/]+)/))
        ) || urls[0];
        data.supplier.website = website.replace(/[.,;]$/, ''); // Remove trailing punctuation
      }
    }
  }

  // Validate extracted data
  validateExtractedData(data);
  
  // Calculate overall confidence from field confidences
  const fieldConfidences = Object.values(data.field_confidence || {});
  if (fieldConfidences.length > 0) {
    data.confidence_score = fieldConfidences.reduce((a, b) => a + b, 0) / fieldConfidences.length;
  } else {
    // Fallback to page confidence or default
    const avgPageConfidence = pageConfidences.length > 0 
      ? pageConfidences.reduce((a, b) => a + b, 0) / pageConfidences.length 
      : 0.7;
    data.confidence_score = avgPageConfidence;
  }
  
  // Calculate extraction metrics
  const fieldsExtracted: string[] = [];
  const fieldsMissing: string[] = [];
  const methodDistribution: Record<string, number> = {};
  
  // Track extracted fields
  if (data.vendor_name) fieldsExtracted.push('vendor_name');
  else fieldsMissing.push('vendor_name');
  if (data.invoice_date) fieldsExtracted.push('invoice_date');
  else fieldsMissing.push('invoice_date');
  if (data.invoice_number) fieldsExtracted.push('invoice_number');
  else fieldsMissing.push('invoice_number');
  if (data.total !== undefined) fieldsExtracted.push('total');
  else fieldsMissing.push('total');
  if (data.subtotal !== undefined) fieldsExtracted.push('subtotal');
  if (data.tax !== undefined) fieldsExtracted.push('tax');
  if (data.line_items && data.line_items.length > 0) fieldsExtracted.push('line_items');
  
  // Count extraction methods
  Object.values(data.extraction_methods || {}).forEach(method => {
    methodDistribution[method] = (methodDistribution[method] || 0) + 1;
  });
  
  data.extraction_metrics = {
    fields_extracted: fieldsExtracted.length,
    fields_missing: fieldsMissing,
    average_confidence: data.confidence_score,
    method_distribution: methodDistribution,
  };
  
  // Determine if review is needed
  // Critical fields: total, vendor_name, invoice_date
  const criticalFieldsMissing = [];
  if (!data.total && !data.subtotal) criticalFieldsMissing.push('total');
  if (!data.vendor_name && !data.supplier?.name) criticalFieldsMissing.push('vendor_name');
  if (!data.invoice_date) criticalFieldsMissing.push('invoice_date');
  
  // Flag for review if:
  // - Any critical field is missing
  // - Low confidence on critical fields
  // - Overall confidence is low
  // - Amount validation failed
  const hasLowConfidenceFields = Object.entries(data.field_confidence || {}).some(([field, conf]) => {
    const isCritical = ['total', 'vendor_name', 'invoice_date'].includes(field);
    return isCritical && conf < MEDIUM_CONFIDENCE;
  });
  
  const hasValidationFailures = Object.values(data.validation_flags || {}).some(valid => valid === false);
  
  data.needs_review = criticalFieldsMissing.length > 0 ||
                      hasLowConfidenceFields ||
                      fieldsMissing.length > 2 ||
                      data.confidence_score! < MEDIUM_CONFIDENCE ||
                      hasValidationFailures;
  
  // Log review reasons for debugging
  if (data.needs_review) {
    console.log('[DocumentAI] Invoice flagged for review:', {
      criticalFieldsMissing,
      hasLowConfidenceFields,
      fieldsMissing,
      confidenceScore: data.confidence_score,
      hasValidationFailures,
    });
  }
  
  // Debug logging for extraction diagnostics
  const extractionSummary = {
    hasTotal: !!data.total,
    total: data.total,
    hasSubtotal: !!data.subtotal,
    subtotal: data.subtotal,
    hasTax: !!data.tax,
    tax: data.tax,
    hasLineItems: !!data.line_items,
    lineItemsCount: data.line_items?.length || 0,
    vendorName: data.vendor_name,
    hasDate: !!data.invoice_date,
    hasOrderNumber: !!data.order_number,
    hasSupplier: !!data.supplier,
    hasSupplierEmail: !!data.supplier?.email,
    extractedTextLength: data.extracted_text?.length || 0,
    extractedTextPreview: data.extracted_text?.substring(0, 200) || '',
    confidenceScore: data.confidence_score,
    needsReview: data.needs_review,
    extractionMetrics: data.extraction_metrics,
  };
  
  // Log if extraction seems incomplete
  if (!data.total && !data.subtotal && data.extracted_text && data.extracted_text.length > 0) {
    console.warn("[DocumentAI] Amount extraction failed - no totals found", {
      textLength: data.extracted_text.length,
      textPreview: data.extracted_text.substring(0, 500),
      hasEntities: !!document.entities,
      entitiesCount: document.entities?.length || 0,
      hasTables: !!(document.pages && document.pages[0]?.tables),
      tablesCount: document.pages?.[0]?.tables?.length || 0,
    });
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'google-document-ai.ts:308',message:'OCR processing completed',data:extractionSummary,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
  // #endregion
  return data;
}

/**
 * Validate extracted invoice data
 */
function validateExtractedData(data: InvoiceData): void {
  if (!data.validation_flags) {
    data.validation_flags = {};
  }
  
  // Validate dates
  if (data.invoice_date) {
    const date = new Date(data.invoice_date);
    const isValid = !isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2100;
    data.validation_flags['invoice_date'] = isValid;
    if (!isValid) {
      console.warn("[DocumentAI] Invalid invoice date:", data.invoice_date);
    }
  }
  
  if (data.delivery_date) {
    const date = new Date(data.delivery_date);
    const isValid = !isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2100;
    data.validation_flags['delivery_date'] = isValid;
  }
  
  // Validate amounts
  const validateAmount = (field: string, value: number | undefined) => {
    if (value !== undefined) {
      const isValid = value >= -MAX_REASONABLE_AMOUNT && value <= MAX_REASONABLE_AMOUNT && !isNaN(value);
      data.validation_flags![field] = isValid;
      if (!isValid) {
        console.warn(`[DocumentAI] Invalid ${field}:`, value);
      }
    }
  };
  
  validateAmount('total', data.total);
  validateAmount('subtotal', data.subtotal);
  validateAmount('tax', data.tax);
  validateAmount('fee_amount', data.fee_amount);
  validateAmount('shipping_amount', data.shipping_amount);
  
  // Validate invoice number format
  if (data.invoice_number) {
    // Invoice numbers should be alphanumeric with possible dashes/underscores
    const isValid = /^[A-Z0-9\-_]+$/i.test(data.invoice_number) && data.invoice_number.length >= 3;
    data.validation_flags!['invoice_number'] = isValid;
    if (!isValid) {
      console.warn("[DocumentAI] Suspicious invoice number format:", data.invoice_number);
    }
  }
  
  // Validate vendor name
  if (data.vendor_name) {
    const isValid = data.vendor_name.length >= 2 && data.vendor_name.length <= 200;
    data.validation_flags!['vendor_name'] = isValid;
  }
  
  // Validate currency
  if (data.currency) {
    const isValid = /^[A-Z]{3}$/.test(data.currency);
    data.validation_flags!['currency'] = isValid;
  }
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
  
  // Handle negative amounts (credit/refund)
  let isNegative = /^[-–—]/.test(value.trim()) || /\(.*\)/.test(value);
  
  // Remove currency symbols, spaces, and parse number
  // Handle both comma and period as decimal separators
  // First, normalize: remove currency symbols, spaces, but keep digits, dots, commas, and minus signs
  let cleaned = value.replace(/[£$€¥₹]/g, "").trim();
  
  // Handle parentheses notation for negative: (123.45) = -123.45
  if (/^\(.*\)$/.test(cleaned)) {
    cleaned = cleaned.replace(/[()]/g, "");
    isNegative = true;
  }
  
  // Determine decimal separator: if comma appears after period, comma is thousands separator
  // If comma appears before period or alone, it might be decimal separator (European format)
  const hasComma = cleaned.includes(',');
  const hasPeriod = cleaned.includes('.');
  
  if (hasComma && hasPeriod) {
    // Both present: determine which is decimal separator
    const commaPos = cleaned.lastIndexOf(',');
    const periodPos = cleaned.lastIndexOf('.');
    if (commaPos > periodPos) {
      // Comma is decimal separator (European format: 1.234,56)
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // Period is decimal separator (US format: 1,234.56)
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (hasComma && !hasPeriod) {
    // Only comma: could be decimal separator (European) or thousands separator
    // If comma is followed by exactly 2 digits, it's likely decimal separator
    const commaMatch = cleaned.match(/,(\d{2})$/);
    if (commaMatch) {
      cleaned = cleaned.replace(/,/g, ".");
    } else {
      // Otherwise treat as thousands separator
      cleaned = cleaned.replace(/,/g, "");
    }
  } else {
    // Only period or neither: standard format
    cleaned = cleaned.replace(/,/g, "");
  }
  
  // Remove all non-numeric characters except decimal point and minus sign
  cleaned = cleaned.replace(/[^0-9.-]/g, "");
  
  // Remove multiple decimal points (keep only the last one)
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
  }

  // Some OCR outputs drop separators entirely (e.g. "2024" meaning "20.24").
  // If the original had no explicit separator and we ended up with a long digit-only string,
  // treat the last 2 digits as cents.
  const originalTrimmed = value.trim();
  const hasExplicitSeparator = /[.,]/.test(originalTrimmed);
  const digitOnly = /^[0-9]+$/.test(cleaned);
  if (!hasExplicitSeparator && digitOnly && cleaned.length >= 4) {
    const implied = `${cleaned.slice(0, -2)}.${cleaned.slice(-2)}`;
    const impliedAmount = parseFloat(implied);
    if (!isNaN(impliedAmount) && Math.abs(impliedAmount) <= MAX_REASONABLE_AMOUNT) {
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "apps/portal/lib/ocr/google-document-ai.ts:parseAmount:impliedCents",
          message: "Applied implied-cents heuristic for digit-only amount",
          data: { original: originalTrimmed.slice(0, 60), cleaned, implied, impliedAmount },
          timestamp: Date.now(),
          sessionId: "debug-session",
          runId: "run1",
          hypothesisId: "AMT1",
        }),
      }).catch(() => {});
      // #endregion

      cleaned = implied;
    }
  }
  
  const amount = parseFloat(cleaned);
  
  if (isNaN(amount)) return undefined;
  
  const finalAmount = isNegative ? -Math.abs(amount) : amount;
  
  // Validate amount is reasonable (not a date or reference number parsed incorrectly)
  // Reject amounts that are suspiciously large (likely parsing errors)
  if (Math.abs(finalAmount) > MAX_REASONABLE_AMOUNT) {
    console.warn(`[parseAmount] Rejected suspiciously large amount: ${finalAmount} (original: ${value})`);
    return undefined;
  }
  
  // Reject amounts that look like dates (e.g., 20241228, 2024-12-28)
  // If the number is exactly 8 digits and starts with 19 or 20, it's likely a date
  const numericOnly = cleaned.replace(/[^0-9]/g, "");
  if (numericOnly.length === 8 && /^(19|20)\d{6}$/.test(numericOnly)) {
    console.warn(`[parseAmount] Rejected date-like value as amount: ${value}`);
    return undefined;
  }
  
  return finalAmount;
}
