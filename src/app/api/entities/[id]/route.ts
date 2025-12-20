import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";

interface EntityUpdateInput {
  name?: string;
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
  is_active?: boolean;
}

/**
 * GET: Get a single entity by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch entity
    const { data: entity, error } = await supabase
      .from("entities")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !entity) {
      return NextResponse.json(
        { error: "Entity not found" },
        { status: 404 }
      );
    }

    // Get document count for this entity
    const { count: documentCount } = await supabase
      .from("financial_documents")
      .select("*", { count: "exact", head: true })
      .eq("entity_id", id)
      .eq("is_deleted", false);

    return NextResponse.json({
      entity,
      stats: {
        documentCount: documentCount || 0,
      },
    });
  } catch (error) {
    console.error("Entity fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Update an entity
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check entity exists and user has access
    const { data: existing, error: fetchError } = await supabase
      .from("entities")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Entity not found" },
        { status: 404 }
      );
    }

    // Parse request body
    const body: EntityUpdateInput = await request.json();

    // Build update object
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json(
          { error: "Name cannot be empty" },
          { status: 400 }
        );
      }
      updates.name = body.name.trim();
    }

    if (body.email !== undefined) {
      if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }
      updates.email = body.email?.trim() || null;
    }

    if (body.phone !== undefined) {
      updates.phone = body.phone?.trim() || null;
    }

    if (body.address !== undefined) {
      updates.address = body.address;
    }

    if (body.metadata !== undefined) {
      updates.metadata = body.metadata;
    }

    if (body.is_active !== undefined) {
      updates.is_active = body.is_active;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update entity
    const { data: entity, error: updateError } = await (supabase
      .from("entities") as any)
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Entity update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update entity" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      entity,
    });
  } catch (error) {
    console.error("Entity update error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Delete an entity (soft delete by setting is_active = false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check entity exists
    const { data: existing, error: fetchError } = await supabase
      .from("entities")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Entity not found" },
        { status: 404 }
      );
    }

    // Check if entity has documents - prevent deletion if so
    const { count: documentCount } = await supabase
      .from("financial_documents")
      .select("*", { count: "exact", head: true })
      .eq("entity_id", id)
      .eq("is_deleted", false);

    if (documentCount && documentCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete entity with ${documentCount} documents. Delete or reassign documents first.` },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active = false
    const { error: updateError } = await (supabase
      .from("entities") as any)
      .update({ is_active: false } as never)
      .eq("id", id);

    if (updateError) {
      console.error("Entity delete error:", updateError);
      return NextResponse.json(
        { error: "Failed to delete entity" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Entity deleted successfully",
    });
  } catch (error) {
    console.error("Entity delete error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

