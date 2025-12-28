import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

/**
 * GET: Get OCR extraction statistics and metrics
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    // Build query
    let query = supabase
      .from("financial_documents")
      .select("ocr_field_confidence, ocr_extraction_methods, ocr_validation_flags, ocr_metrics, ocr_needs_review, ocr_confidence, ocr_status")
      .eq("user_id", user.id)
      .eq("ocr_status", "completed")
      .limit(limit);

    if (startDate) {
      query = query.gte("ocr_processed_at", startDate);
    }
    if (endDate) {
      query = query.lte("ocr_processed_at", endDate);
    }

    const { data: documents, error: documentsError } = await query;

    if (documentsError) {
      console.error("Error fetching OCR metrics:", documentsError);
      return NextResponse.json(
        { error: "Failed to fetch OCR metrics" },
        { status: 500 }
      );
    }

    // Aggregate statistics
    const stats = {
      total_documents: documents?.length || 0,
      needs_review_count: documents?.filter((d: any) => d.ocr_needs_review).length || 0,
      average_confidence: 0,
      field_extraction_stats: {} as Record<string, { extracted: number; average_confidence: number }>,
      method_distribution: {} as Record<string, number>,
      validation_stats: {} as Record<string, { valid: number; invalid: number }>,
    };

    let totalConfidence = 0;
    let confidenceCount = 0;
    const fieldConfidences: Record<string, number[]> = {};
    const methodCounts: Record<string, number> = {};
    const validationCounts: Record<string, { valid: number; invalid: number }> = {};

    documents?.forEach((doc: any) => {
      // Average confidence
      if (doc.ocr_confidence !== null && doc.ocr_confidence !== undefined) {
        totalConfidence += doc.ocr_confidence;
        confidenceCount++;
      }

      // Field confidence and extraction methods
      if (doc.ocr_field_confidence && typeof doc.ocr_field_confidence === 'object') {
        Object.keys(doc.ocr_field_confidence).forEach((field: string) => {
          const conf = doc.ocr_field_confidence[field];
          if (!fieldConfidences[field]) {
            fieldConfidences[field] = [];
          }
          if (typeof conf === 'number') {
            fieldConfidences[field].push(conf);
          }
        });
      }

      if (doc.ocr_extraction_methods && typeof doc.ocr_extraction_methods === 'object') {
        Object.values(doc.ocr_extraction_methods).forEach((method: any) => {
          methodCounts[method] = (methodCounts[method] || 0) + 1;
        });
      }

      // Validation flags
      if (doc.ocr_validation_flags && typeof doc.ocr_validation_flags === 'object') {
        Object.keys(doc.ocr_validation_flags).forEach((field: string) => {
          if (!validationCounts[field]) {
            validationCounts[field] = { valid: 0, invalid: 0 };
          }
          const isValid = doc.ocr_validation_flags[field];
          if (isValid === true) {
            validationCounts[field].valid++;
          } else if (isValid === false) {
            validationCounts[field].invalid++;
          }
        });
      }
    });

    // Calculate averages
    stats.average_confidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

    Object.keys(fieldConfidences).forEach((field) => {
      const confidences = fieldConfidences[field];
      const avgConf = confidences.reduce((a, b) => a + b, 0) / confidences.length;
      stats.field_extraction_stats[field] = {
        extracted: confidences.length,
        average_confidence: avgConf,
      };
    });

    stats.method_distribution = methodCounts;
    stats.validation_stats = validationCounts;

    return NextResponse.json({
      success: true,
      stats,
      documents_analyzed: documents?.length || 0,
    });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

