import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

/**
 * GET: Get all suppliers for the user
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

    // Get all suppliers for the user
    const { data: suppliers, error: suppliersError } = await supabase
      .from("suppliers")
      .select("id, name, email, phone")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (suppliersError) {
      console.error("Error fetching suppliers:", suppliersError);
      return NextResponse.json(
        { error: "Failed to fetch suppliers" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      suppliers: suppliers || [],
    });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a new supplier
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, email, phone, address } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Supplier name is required" },
        { status: 400 }
      );
    }

    // Get tenant_id
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    // Create supplier
    const { data: supplier, error: createError } = await supabase
      .from("suppliers")
      .insert({
        user_id: user.id,
        tenant_id: userData?.tenant_id || null,
        name,
        email: email || null,
        phone: phone || null,
        address_street: address?.street || null,
        address_city: address?.city || null,
        address_postcode: address?.postcode || null,
        address_country: address?.country || null,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating supplier:", createError);
      return NextResponse.json(
        { error: "Failed to create supplier", details: createError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      supplier,
    });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

