import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/core/database/server';
import { processInvoiceOCR } from '@/lib/ocr/google-document-ai';
import { verifyOCRSource } from '@/lib/ocr/google-document-ai';

/**
 * Process OCR for a document
 * Extracts text, entities, and tax breakdown from uploaded documents
 * Uses the comprehensive invoice extraction system
 */

export const maxDuration = 300; // 5 minutes for OCR processing

// Type for financial_documents query result
interface FinancialDocument {
  id: string;
  ocr_status: string;
  supabase_path?: string;
  storage_path?: string;
  storage_bucket?: string;
  mime_type: string;
  original_filename?: string;
  [key: string]: any;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    // Cast to any to bypass type checking for tables not in generated types
    const db = supabase as any;
    
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: 'Missing documentId' },
        { status: 400 }
      );
    }

    // Get document
    const { data: document, error: docError } = await db
      .from('financial_documents')
      .select('*')
      .eq('id', documentId)
      .single() as { data: FinancialDocument | null; error: any };

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Check if already processed
    if (document.ocr_status === 'completed') {
      return NextResponse.json({
        success: true,
        message: 'Document already processed',
      });
    }

    // Update status to processing
    await db
      .from('financial_documents')
      .update({ ocr_status: 'processing' })
      .eq('id', documentId);

    try {
      // Download file from storage
      const storagePath = document.supabase_path || document.storage_path;
      const storageBucket = document.storage_bucket || 'documents';

      if (!storagePath) {
        throw new Error('Document has no storage path');
      }

      const { data: fileData, error: downloadError } = await supabase.storage
        .from(storageBucket)
        .download(storagePath);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download file: ${downloadError?.message}`);
      }

      // Process with comprehensive invoice OCR
      const fileName = document.original_filename || storagePath.split('/').pop() || 'invoice.pdf';
      const invoiceData = await processInvoiceOCR(fileData, fileName);

      // Verify OCR source
      const ocrVerification = verifyOCRSource();

      // Build update object with all extracted fields
      const updateData: Record<string, any> = {
        ocr_status: invoiceData.ocr_failed ? 'failed' : 'completed',
        ocr_processed_at: new Date().toISOString(),
        ocr_confidence_score: invoiceData.confidence_score || 0,
        ocr_provider: ocrVerification.provider,
        extracted_text: invoiceData.extracted_text || '',
      };

      // Map extracted fields correctly
      if (invoiceData.vendor_name) {
        updateData.vendor_name = invoiceData.vendor_name;
      }

      if (invoiceData.invoice_date) {
        updateData.document_date = invoiceData.invoice_date;
      }

      if (invoiceData.invoice_number) {
        updateData.invoice_number = invoiceData.invoice_number;
      }

      if (invoiceData.total !== undefined) {
        updateData.total_amount = invoiceData.total;
      }

      if (invoiceData.subtotal !== undefined) {
        updateData.subtotal_amount = invoiceData.subtotal;
      }

      if (invoiceData.tax !== undefined) {
        updateData.tax_amount = invoiceData.tax; // VAT total
      }

      if (invoiceData.line_items && invoiceData.line_items.length > 0) {
        updateData.line_items = invoiceData.line_items;
      }

      if (invoiceData.currency) {
        updateData.currency = invoiceData.currency;
      }

      // Store additional metadata (map to database column names)
      if (invoiceData.field_confidence) {
        updateData.ocr_field_confidence = invoiceData.field_confidence;
      }

      if (invoiceData.extraction_methods) {
        updateData.ocr_extraction_methods = invoiceData.extraction_methods;
      }

      if (invoiceData.needs_review !== undefined) {
        updateData.ocr_needs_review = invoiceData.needs_review;
      }

      if (invoiceData.shipping_amount !== undefined) {
        updateData.shipping_amount = invoiceData.shipping_amount;
      }

      // Calculate net amount if not provided
      if (updateData.total_amount && updateData.tax_amount !== undefined) {
        updateData.net_amount = updateData.total_amount - updateData.tax_amount;
      }

      // Handle OCR errors
      if (invoiceData.ocr_error) {
        updateData.ocr_error = invoiceData.ocr_error;
      }

      // Update document with extracted data
      const { error: updateError } = await db
        .from('financial_documents')
        .update(updateData)
        .eq('id', documentId);

      if (updateError) {
        throw new Error(`Failed to update document: ${updateError.message}`);
      }

      // Trigger auto-match with transactions
      if (process.env.NEXT_PUBLIC_APP_URL && !invoiceData.ocr_failed) {
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reconciliation/auto-match`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId }),
        }).catch(err => console.error('Auto-match trigger error:', err));
      }

      return NextResponse.json({
        success: true,
        documentId,
        extracted: {
          vendor: invoiceData.vendor_name,
          date: invoiceData.invoice_date,
          invoiceNumber: invoiceData.invoice_number,
          total: invoiceData.total,
          subtotal: invoiceData.subtotal,
          tax: invoiceData.tax,
          currency: invoiceData.currency,
          lineItems: invoiceData.line_items?.length || 0,
          confidence: invoiceData.confidence_score,
          needsReview: invoiceData.needs_review,
        },
      });

    } catch (error: any) {
      console.error('OCR processing error:', error);

      // Update status to failed
      await db
        .from('financial_documents')
        .update({
          ocr_status: 'failed',
          ocr_error: error.message,
        })
        .eq('id', documentId);

      return NextResponse.json(
        { error: error.message || 'OCR processing failed' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Process OCR error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
