import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";

interface Entity {
  id: string;
  tenant_id: string | null;
  owner_user_id: string | null;
  entity_type: "person" | "business";
  name: string;
  tax_id_encrypted: string | null;
  email: string | null;
  phone: string | null;
  address: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EntityInput {
  entity_type: "person" | "business";
  name: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * GET: List entities for the current user/tenant
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
    const entityType = searchParams.get("type");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const activeOnly = searchParams.get("active") !== "false";

    // Build query
    let query = supabase
      .from("entities")
      .select("*", { count: "exact" });

    // Filter by active status
    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    // Filter by entity type
    if (entityType && ["person", "business"].includes(entityType)) {
      query = query.eq("entity_type", entityType);
    }

    // Search by name
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    // Apply pagination
    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: entities, error, count } = await query;

    if (error) {
      console.error("Entity fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch entities" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      entities,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: count ? offset + limit < count : false,
      },
    });
  } catch (error) {
    console.error("Entity list error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a new entity
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get tenant_id for the user
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const tenantId = userData?.tenant_id || null;

    // Parse request body
    const body: EntityInput = await request.json();

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!body.entity_type || !["person", "business"].includes(body.entity_type)) {
      return NextResponse.json(
        { error: "Invalid entity type. Must be 'person' or 'business'" },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Create entity
    const { data: entity, error: insertError } = await supabase
      .from("entities")
      .insert({
        tenant_id: tenantId,
        owner_user_id: user.id,
        entity_type: body.entity_type,
        name: body.name.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        address: body.address || null,
        metadata: body.metadata || {},
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Entity insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create entity" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      entity,
    }, { status: 201 });
  } catch (error) {
    console.error("Entity create error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

