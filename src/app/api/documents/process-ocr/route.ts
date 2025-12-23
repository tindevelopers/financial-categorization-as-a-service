import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/core/database/server';
import { processDocument } from '@/lib/ocr/document-ai';

/**
 * Process OCR for a document
 * Extracts text, entities, and tax breakdown from uploaded documents
 */

export const maxDuration = 300; // 5 minutes for OCR processing

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: 'Missing documentId' },
        { status: 400 }
      );
    }

    // Get document
    const { data: document, error: docError } = await supabase
      .from('financial_documents')
      .select('*')
      .eq('id', documentId)
      .single();

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
    await supabase
      .from('financial_documents')
      .update({ ocr_status: 'processing' })
      .eq('id', documentId);

    try {
      // Download file from storage
      const storagePath = document.supabase_path || document.storage_path;
      const storageBucket = document.storage_bucket || 'documents';

      const { data: fileData, error: downloadError } = await supabase.storage
        .from(storageBucket)
        .download(storagePath);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download file: ${downloadError?.message}`);
      }

      // Convert Blob to Buffer
      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Process with OCR
      const ocrResult = await processDocument(buffer, document.mime_type);

      if (!ocrResult.success || !ocrResult.data) {
        throw new Error(ocrResult.error || 'OCR processing failed');
      }

      // Extract tax breakdown
      const extractedData = ocrResult.data;

      // Build update object
      const updateData: any = {
        ocr_status: 'completed',
        ocr_processed_at: new Date().toISOString(),
        ocr_confidence: ocrResult.confidence || 0,
        extracted_text: extractedData.extractedText || '',
      };

      // Add extracted fields if available
      if (extractedData.vendorName) {
        updateData.vendor_name = extractedData.vendorName;
      }

      if (extractedData.documentDate) {
        updateData.document_date = extractedData.documentDate;
      }

      if (extractedData.totalAmount !== undefined) {
        updateData.total_amount = extractedData.totalAmount;
      }

      if (extractedData.subtotalAmount !== undefined) {
        updateData.subtotal_amount = extractedData.subtotalAmount;
      }

      if (extractedData.taxAmount !== undefined) {
        updateData.tax_amount = extractedData.taxAmount;
      }

      if (extractedData.taxRate !== undefined) {
        updateData.tax_rate = extractedData.taxRate;
      }

      if (extractedData.lineItems && extractedData.lineItems.length > 0) {
        updateData.line_items = extractedData.lineItems;
      }

      if (extractedData.currency) {
        updateData.currency = extractedData.currency;
      }

      if (extractedData.invoiceNumber) {
        updateData.po_number = extractedData.invoiceNumber;
      }

      // Calculate net amount if not provided
      if (updateData.total_amount && updateData.tax_amount !== undefined) {
        updateData.net_amount = updateData.total_amount - updateData.tax_amount;
      }

      // Update document with extracted data
      const { error: updateError } = await supabase
        .from('financial_documents')
        .update(updateData)
        .eq('id', documentId);

      if (updateError) {
        throw new Error(`Failed to update document: ${updateError.message}`);
      }

      // Trigger auto-match with transactions
      if (process.env.NEXT_PUBLIC_APP_URL) {
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
          vendor: extractedData.vendorName,
          date: extractedData.documentDate,
          total: extractedData.totalAmount,
          subtotal: extractedData.subtotalAmount,
          tax: extractedData.taxAmount,
          taxRate: extractedData.taxRate,
          lineItems: extractedData.lineItems?.length || 0,
        },
      });

    } catch (error: any) {
      console.error('OCR processing error:', error);

      // Update status to failed
      await supabase
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
