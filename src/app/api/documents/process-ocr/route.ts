import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/core/database/admin-client";
import { processDocument } from "@/lib/ocr/document-ai";

/**
 * OCR Processing Endpoint
 * This can be called by a cron job or triggered after upload
 * Processes pending documents with OCR
 */

export const maxDuration = 300; // 5 minutes for batch processing

interface ProcessResult {
  documentId: string;
  success: boolean;
  error?: string;
}

/**
 * POST: Process a specific document or batch of pending documents
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify request is authorized (cron job or admin)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Check if this is a cron job or authenticated request
    const isCronRequest = cronSecret && authHeader === `Bearer ${cronSecret}`;
    
    if (!isCronRequest) {
      // Check for authenticated admin user
      const supabase = createAdminClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    const documentId = body.documentId as string | undefined;
    const batchSize = Math.min(body.batchSize || 10, 50); // Max 50 at a time

    const supabase = createAdminClient();
    const results: ProcessResult[] = [];

    if (documentId) {
      // Process a specific document
      const result = await processDocumentOCR(supabase, documentId);
      results.push(result);
    } else {
      // Define document type
      type PendingDocument = {
        id: string;
        supabase_path: string | null;
        mime_type: string | null;
        file_type: string | null;
      };

      // Process pending documents
      const { data: pendingDocs, error: fetchError } = await (supabase
        .from("financial_documents") as any)
        .select("id, supabase_path, mime_type, file_type")
        .eq("ocr_status", "pending")
        .eq("is_deleted", false)
        .order("created_at", { ascending: true })
        .limit(batchSize);

      if (fetchError) {
        console.error("Failed to fetch pending documents:", fetchError);
        return NextResponse.json(
          { error: "Failed to fetch pending documents" },
          { status: 500 }
        );
      }

      if (!pendingDocs) {
        return NextResponse.json({
          success: true,
          message: "No pending documents to process",
          processed: 0,
        });
      }

      if (pendingDocs.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No pending documents to process",
          processed: 0,
        });
      }

      // Type assertion for documents
      const docs: PendingDocument[] = pendingDocs as PendingDocument[];

      // Process each document
      for (const doc of docs) {
        const result = await processDocumentOCR(
          supabase,
          doc.id,
          doc.supabase_path || undefined,
          doc.mime_type || undefined,
          doc.file_type || undefined
        );
        results.push(result);
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      processed: results.length,
      successful,
      failed,
      results,
    });
  } catch (error) {
    console.error("OCR processing error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    );
  }
}

/**
 * Process a single document with OCR
 */
async function processDocumentOCR(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  documentId: string,
  supabasePath?: string,
  mimeType?: string,
  fileType?: string
): Promise<ProcessResult> {
  try {
    // If not provided, fetch document details
    if (!supabasePath || !mimeType) {
      const { data: doc, error: fetchError } = await (supabase
        .from("financial_documents") as any)
        .select("supabase_path, mime_type, file_type")
        .eq("id", documentId)
        .single();

      if (fetchError || !doc) {
        return {
          documentId,
          success: false,
          error: "Document not found",
        };
      }

      supabasePath = doc.supabase_path;
      mimeType = doc.mime_type;
      fileType = doc.file_type;
    }

    if (!supabasePath) {
      return {
        documentId,
        success: false,
        error: "No storage path available",
      };
    }

    // Mark as processing
    await (supabase
      .from("financial_documents") as any)
      .update({
        ocr_status: "processing",
        ocr_started_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("financial-documents")
      .download(supabasePath);

    if (downloadError || !fileData) {
      await (supabase
        .from("financial_documents") as any)
        .update({
          ocr_status: "failed",
          ocr_error: `Download failed: ${downloadError?.message || "No data"}`,
        })
        .eq("id", documentId);

      return {
        documentId,
        success: false,
        error: `Download failed: ${downloadError?.message || "No data"}`,
      };
    }

    // Convert Blob to Buffer
    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Process with Document AI
    const ocrResult = await processDocument(buffer, mimeType!, fileType || "other");

    if (!ocrResult.success) {
      await (supabase
        .from("financial_documents") as any)
        .update({
          ocr_status: "failed",
          ocr_error: ocrResult.error,
          ocr_completed_at: new Date().toISOString(),
        })
        .eq("id", documentId);

      return {
        documentId,
        success: false,
        error: ocrResult.error,
      };
    }

    // Update document with extracted data
    const updates: Record<string, unknown> = {
      ocr_status: "completed",
      ocr_completed_at: new Date().toISOString(),
      extracted_text: ocrResult.text,
      extracted_data: ocrResult.extractedData || {},
      ocr_confidence: ocrResult.confidence,
    };

    // Also update extracted metadata fields if available
    if (ocrResult.extractedData) {
      if (ocrResult.extractedData.documentDate) {
        updates.document_date = ocrResult.extractedData.documentDate;
      }
      if (ocrResult.extractedData.vendorName) {
        updates.vendor_name = ocrResult.extractedData.vendorName;
      }
      if (ocrResult.extractedData.totalAmount !== undefined) {
        updates.total_amount = ocrResult.extractedData.totalAmount;
      }
      if (ocrResult.extractedData.currency) {
        updates.currency = ocrResult.extractedData.currency;
      }
      if (ocrResult.extractedData.periodStart) {
        updates.period_start = ocrResult.extractedData.periodStart;
      }
      if (ocrResult.extractedData.periodEnd) {
        updates.period_end = ocrResult.extractedData.periodEnd;
      }
      if (ocrResult.extractedData.accountNumber) {
        updates.account_number_masked = ocrResult.extractedData.accountNumber;
      }
    }

    await (supabase
      .from("financial_documents") as any)
      .update(updates)
      .eq("id", documentId);

    return {
      documentId,
      success: true,
    };
  } catch (error) {
    console.error(`OCR error for document ${documentId}:`, error);

    try {
      await (supabase
        .from("financial_documents") as any)
        .update({
          ocr_status: "failed",
          ocr_error: error instanceof Error ? error.message : "Unknown error",
          ocr_completed_at: new Date().toISOString(),
        })
        .eq("id", documentId);
    } catch {
      // Ignore update errors
    }

    return {
      documentId,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * GET: Get OCR processing status and queue info
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = createAdminClient();

    // Get counts by status
    const statuses = ["pending", "processing", "completed", "failed"];
    const counts: Record<string, number> = {};

    for (const status of statuses) {
      const { count } = await (supabase
        .from("financial_documents") as any)
        .select("*", { count: "exact", head: true })
        .eq("ocr_status", status)
        .eq("is_deleted", false);

      counts[status] = count || 0;
    }

    return NextResponse.json({
      queue: counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    });
  } catch (error) {
    console.error("OCR status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get status" },
      { status: 500 }
    );
  }
}

