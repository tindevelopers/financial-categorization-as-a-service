/**
 * AI-Powered Field Extraction Fallback
 * 
 * Uses Vercel AI Gateway to intelligently extract invoice fields
 * from raw text when Document AI entities are incomplete.
 */

import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";

// Schema for extracted invoice fields
const invoiceFieldsSchema = z.object({
  vendor_name: z.string().nullable().describe("The name of the company/vendor who issued the invoice"),
  invoice_number: z.string().nullable().describe("The unique invoice number or reference"),
  invoice_date: z.string().nullable().describe("The date the invoice was issued (format: YYYY-MM-DD)"),
  total_amount: z.number().nullable().describe("The total amount due on the invoice"),
  subtotal: z.number().nullable().describe("The subtotal before tax/VAT"),
  tax_amount: z.number().nullable().describe("The VAT/tax amount"),
  currency: z.enum(["GBP", "EUR", "USD"]).nullable().describe("The currency of the invoice"),
  line_items: z.array(z.object({
    description: z.string().describe("Description of the item or service"),
    quantity: z.number().nullable().describe("Quantity of items"),
    unit_price: z.number().nullable().describe("Price per unit"),
    total: z.number().describe("Total for this line item"),
  })).nullable().describe("List of individual line items on the invoice"),
  confidence: z.number().min(0).max(1).describe("Confidence score for the extraction (0.0 to 1.0)"),
  reasoning: z.string().describe("Brief explanation of what was extracted and any uncertainties"),
});

export type AIExtractedFields = z.infer<typeof invoiceFieldsSchema>;

/**
 * Extract invoice fields from raw text using AI
 * 
 * This is a fallback when Document AI entities don't provide complete data.
 * It uses the Vercel AI Gateway to intelligently parse unstructured invoice text.
 * 
 * @param rawText - The raw text extracted from the invoice document
 * @param existingData - Any fields already extracted by Document AI (to avoid overwriting)
 * @returns Extracted invoice fields with confidence score
 */
export async function extractFieldsWithAI(
  rawText: string,
  existingData?: Partial<AIExtractedFields>
): Promise<AIExtractedFields | null> {
  if (!rawText || rawText.trim().length < 50) {
    console.log("[AI Field Extraction] Text too short for AI extraction");
    return null;
  }

  try {
    const model = gateway("anthropic/claude-3-5-sonnet-latest");
    
    // Truncate text if too long (to avoid token limits)
    const maxTextLength = 8000;
    const truncatedText = rawText.length > maxTextLength 
      ? rawText.substring(0, maxTextLength) + "\n...[truncated]"
      : rawText;
    
    const prompt = buildExtractionPrompt(truncatedText, existingData);
    
    console.log("[AI Field Extraction] Sending text to AI for extraction...");
    
    const { object } = await generateObject({
      model,
      schema: invoiceFieldsSchema,
      prompt,
      temperature: 0.1, // Low temperature for consistent extraction
    });
    
    console.log("[AI Field Extraction] AI extraction completed", {
      hasVendor: !!object.vendor_name,
      hasInvoiceNumber: !!object.invoice_number,
      hasDate: !!object.invoice_date,
      hasTotal: object.total_amount !== null,
      confidence: object.confidence,
    });
    
    return object;
  } catch (error: any) {
    console.error("[AI Field Extraction] Failed:", error.message);
    return null;
  }
}

function buildExtractionPrompt(
  rawText: string,
  existingData?: Partial<AIExtractedFields>
): string {
  let prompt = `You are an expert at extracting structured data from invoice documents.

Extract the following information from this invoice text:

1. **vendor_name**: The company/business that issued the invoice (look for company name at top, "From:", "Billed by:", letterhead, etc.)
2. **invoice_number**: The unique invoice reference (look for "Invoice #", "Invoice Number", "Bill number", "Reference", etc.)
3. **invoice_date**: The date the invoice was issued (convert to YYYY-MM-DD format)
4. **total_amount**: The final total amount due (look for "Total", "Amount Due", "Grand Total", etc.)
5. **subtotal**: The amount before VAT/tax
6. **tax_amount**: The VAT or tax amount
7. **currency**: The currency (GBP for £, EUR for €, USD for $)
8. **line_items**: Individual items/services on the invoice

IMPORTANT GUIDELINES:
- For UK dates (DD/MM/YYYY), convert to YYYY-MM-DD format
- Look for the FINAL total, not intermediate subtotals
- The vendor is who SENT the invoice, not who it's BILLED TO
- Be conservative with confidence - if uncertain, use a lower score
- For utility bills, the "Bill number" is the invoice number
- For SaaS invoices (like Lodgify), look for subscription details

`;

  // Add context about already extracted fields
  if (existingData && Object.keys(existingData).length > 0) {
    prompt += `\nNote: Some fields have already been extracted. Only fill in missing or uncertain fields:
`;
    if (existingData.vendor_name) prompt += `- Vendor already detected: ${existingData.vendor_name}\n`;
    if (existingData.invoice_number) prompt += `- Invoice number already detected: ${existingData.invoice_number}\n`;
    if (existingData.invoice_date) prompt += `- Date already detected: ${existingData.invoice_date}\n`;
    if (existingData.total_amount) prompt += `- Total already detected: ${existingData.total_amount}\n`;
  }

  prompt += `\n--- INVOICE TEXT START ---\n${rawText}\n--- INVOICE TEXT END ---\n`;
  
  prompt += `\nExtract all available fields and provide a confidence score (0.0-1.0) based on how certain you are about the extraction.`;

  return prompt;
}

/**
 * Merge AI-extracted fields with existing OCR data
 * 
 * Only fills in missing fields, doesn't overwrite existing data
 * unless the AI has higher confidence.
 */
export function mergeWithExistingData(
  existingData: any,
  aiData: AIExtractedFields
): any {
  const merged = { ...existingData };
  
  // Only fill in missing fields or replace low-confidence ones
  const shouldReplace = (field: string, aiValue: any, aiConfidence: number) => {
    if (aiValue === null || aiValue === undefined) return false;
    const existingValue = existingData[field];
    const existingConfidence = existingData.field_confidence?.[field] || 0;
    
    // Replace if missing or AI has significantly higher confidence
    return !existingValue || (aiConfidence > existingConfidence + 0.2);
  };
  
  if (shouldReplace('vendor_name', aiData.vendor_name, aiData.confidence)) {
    merged.vendor_name = aiData.vendor_name;
    if (!merged.field_confidence) merged.field_confidence = {};
    merged.field_confidence['vendor_name'] = aiData.confidence;
    if (!merged.extraction_methods) merged.extraction_methods = {};
    merged.extraction_methods['vendor_name'] = 'ai_fallback';
  }
  
  if (shouldReplace('invoice_number', aiData.invoice_number, aiData.confidence)) {
    merged.invoice_number = aiData.invoice_number;
    if (!merged.field_confidence) merged.field_confidence = {};
    merged.field_confidence['invoice_number'] = aiData.confidence;
    if (!merged.extraction_methods) merged.extraction_methods = {};
    merged.extraction_methods['invoice_number'] = 'ai_fallback';
  }
  
  if (shouldReplace('invoice_date', aiData.invoice_date, aiData.confidence)) {
    merged.invoice_date = aiData.invoice_date;
    if (!merged.field_confidence) merged.field_confidence = {};
    merged.field_confidence['invoice_date'] = aiData.confidence;
    if (!merged.extraction_methods) merged.extraction_methods = {};
    merged.extraction_methods['invoice_date'] = 'ai_fallback';
  }
  
  if (shouldReplace('total', aiData.total_amount, aiData.confidence)) {
    merged.total = aiData.total_amount;
    if (!merged.field_confidence) merged.field_confidence = {};
    merged.field_confidence['total'] = aiData.confidence;
    if (!merged.extraction_methods) merged.extraction_methods = {};
    merged.extraction_methods['total'] = 'ai_fallback';
  }
  
  if (shouldReplace('subtotal', aiData.subtotal, aiData.confidence)) {
    merged.subtotal = aiData.subtotal;
    if (!merged.field_confidence) merged.field_confidence = {};
    merged.field_confidence['subtotal'] = aiData.confidence;
    if (!merged.extraction_methods) merged.extraction_methods = {};
    merged.extraction_methods['subtotal'] = 'ai_fallback';
  }
  
  if (shouldReplace('tax', aiData.tax_amount, aiData.confidence)) {
    merged.tax = aiData.tax_amount;
    if (!merged.field_confidence) merged.field_confidence = {};
    merged.field_confidence['tax'] = aiData.confidence;
    if (!merged.extraction_methods) merged.extraction_methods = {};
    merged.extraction_methods['tax'] = 'ai_fallback';
  }
  
  if (!merged.currency && aiData.currency) {
    merged.currency = aiData.currency;
  }
  
  // Merge line items if AI extracted more
  if (aiData.line_items && aiData.line_items.length > 0) {
    if (!merged.line_items || merged.line_items.length === 0) {
      merged.line_items = aiData.line_items;
      if (!merged.field_confidence) merged.field_confidence = {};
      merged.field_confidence['line_items'] = aiData.confidence;
      if (!merged.extraction_methods) merged.extraction_methods = {};
      merged.extraction_methods['line_items'] = 'ai_fallback';
    }
  }
  
  return merged;
}

