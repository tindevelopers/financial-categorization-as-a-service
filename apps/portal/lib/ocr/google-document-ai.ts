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
      // Handle tables with or without explicit header rows
      const bodyRows = table.bodyRows || [];
      const headerRows = table.headerRows || [];
      const allRows = [...headerRows, ...bodyRows];
      
      // Skip header rows when processing
      const rowsToProcess = headerRows.length > 0 ? bodyRows : allRows;
      
      for (const row of rowsToProcess) {
        const cells = row.cells || [];
        if (cells.length < 2) continue;
        
        // Skip summary rows (contain "total", "subtotal", "vat", etc.)
        const rowText = cells.map((c: any) => c?.text || '').join(' ').toLowerCase();
        if (rowText.match(/\b(total|subtotal|vat|tax|sub\s*total|delivery|shipping)\b/)) {
          continue;
        }
        
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
          if (amount !== undefined && amount > 0) {
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
  }
  
  // Also parse line items from plain text if not found in tables
  // This helps with invoices that don't have structured tables
  if (!data.line_items || data.line_items.length === 0) {
    data.line_items = [];
    const text = document.text || "";
    const lines = text.split('\n');
    
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
            } else {
              data.line_items.push({
                description,
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
        const matches = Array.from(text.matchAll(pattern));
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
        } else if (found.type === 'total_ex_vat' && !data.total) {
          data.total = found.amount;
          // If we have total ex VAT, we might need to calculate VAT
          // But we'll wait for VAT to be found separately
        } else if (found.type === 'total' && !data.total) {
          data.total = found.amount;
        } else if (found.type === 'subtotal_inc_vat' && !data.subtotal) {
          data.subtotal = found.amount;
        } else if (found.type === 'subtotal_ex_vat' && !data.subtotal) {
          data.subtotal = found.amount;
        } else if (found.type === 'subtotal' && !data.subtotal) {
          data.subtotal = found.amount;
        } else if (found.type === 'vat' && !data.tax) {
          data.tax = found.amount;
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
      const amountRegex = /([£$€]?\s*\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{2})?)\s*[£$€]?/g;
      const allAmounts: Array<{ amount: number; context: string; position: number }> = [];
      
      let match;
      while ((match = amountRegex.exec(text)) !== null) {
        const amountStr = match[1]?.trim();
        if (amountStr) {
          const amount = parseAmount(amountStr);
          if (amount !== undefined && amount > 0) {
            // Get context around the amount (50 chars before and after)
            const start = Math.max(0, match.index - 50);
            const end = Math.min(text.length, match.index + match[0].length + 50);
            const context = text.substring(start, end).toLowerCase();
            
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
        }
      }
      
      // If we have total but not subtotal, and we found VAT, calculate subtotal
      if (data.total && data.tax && !data.subtotal) {
        data.subtotal = data.total - data.tax;
      }
    }
    
    // Extract order number (common patterns: "Order Number:", "Order #", "PO Number:", etc.)
    if (!data.order_number) {
      const orderPatterns = [
        /order\s*(?:number|#|no\.?):\s*([A-Z0-9\-]+)/i,
        /order\s*id[:\s]+([A-Z0-9\-]+)/i,
        /po\s*(?:number|#|no\.?):\s*([A-Z0-9\-]+)/i,
        /purchase\s*order[:\s]+([A-Z0-9\-]+)/i,
      ];
      for (const pattern of orderPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          data.order_number = match[1].trim();
          break;
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
  
  const amount = parseFloat(cleaned);
  
  if (isNaN(amount)) return undefined;
  
  return isNegative ? -Math.abs(amount) : amount;
}
