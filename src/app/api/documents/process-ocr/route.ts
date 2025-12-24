import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/core/database/server';
import { processDocument } from '@/lib/ocr/document-ai';

/**
 * Process OCR for a document
 * Extracts text, entities, and tax breakdown from uploaded documents
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

      // Convert Blob to Buffer
      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Process with OCR
      const documentType = document.file_type || 'invoice';
      const ocrResult = await processDocument(buffer, document.mime_type, documentType);

      if (!ocrResult.success || !ocrResult.extractedData) {
        throw new Error(ocrResult.error || 'OCR processing failed');
      }

      // Extract tax breakdown
      const extractedData = ocrResult.extractedData;

      // Build update object
      const updateData: Record<string, any> = {
        ocr_status: 'completed',
        ocr_processed_at: new Date().toISOString(),
        ocr_confidence: ocrResult.confidence || 0,
        extracted_text: ocrResult.text || '',
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

      if (extractedData.subtotal !== undefined) {
        updateData.subtotal_amount = extractedData.subtotal;
      }

      if (extractedData.taxAmount !== undefined) {
        updateData.tax_amount = extractedData.taxAmount;
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
      const { error: updateError } = await db
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
          subtotal: extractedData.subtotal,
          tax: extractedData.taxAmount,
          lineItems: extractedData.lineItems?.length || 0,
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
