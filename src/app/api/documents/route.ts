import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";

/**
 * GET: List documents with filtering, search, and pagination
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const fileType = searchParams.get("fileType");
    const storageTier = searchParams.get("storageTier");
    const ocrStatus = searchParams.get("ocrStatus");
    const search = searchParams.get("search");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? true : false;

    // Build query
    let query = supabase
      .from("financial_documents")
      .select(
        `
        id,
        entity_id,
        original_filename,
        file_type,
        mime_type,
        file_size_bytes,
        storage_tier,
        ocr_status,
        document_date,
        vendor_name,
        total_amount,
        currency,
        description,
        tags,
        category,
        is_verified,
        created_at,
        updated_at,
        entities:entity_id (
          id,
          name,
          entity_type
        )
      `,
        { count: "exact" }
      )
      .eq("is_deleted", false);

    // Apply filters
    if (entityId) {
      query = query.eq("entity_id", entityId);
    }

    if (fileType) {
      query = query.eq("file_type", fileType);
    }

    if (storageTier) {
      query = query.eq("storage_tier", storageTier);
    }

    if (ocrStatus) {
      query = query.eq("ocr_status", ocrStatus);
    }

    if (fromDate) {
      query = query.gte("document_date", fromDate);
    }

    if (toDate) {
      query = query.lte("document_date", toDate);
    }

    // Full-text search
    if (search) {
      query = query.or(
        `original_filename.ilike.%${search}%,vendor_name.ilike.%${search}%,description.ilike.%${search}%`
      );
    }

    // Apply sorting
    const validSortColumns = ["created_at", "document_date", "original_filename", "vendor_name", "total_amount"];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : "created_at";
    query = query.order(sortColumn, { ascending: sortOrder });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: documents, error: fetchError, count } = await query;

    if (fetchError) {
      console.error("Document fetch error:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      documents,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: count ? offset + limit < count : false,
      },
    });
  } catch (error) {
    console.error("Document list error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

