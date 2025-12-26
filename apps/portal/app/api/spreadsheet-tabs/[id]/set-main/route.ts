import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Verify tab belongs to user
    const { data: existing, error: fetchError } = await supabase
      .from("spreadsheet_tabs")
      .select("id, user_id, spreadsheet_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Spreadsheet tab not found" },
        { status: 404 }
      );
    }

    // Unset other main tabs for this spreadsheet
    await supabase
      .from("spreadsheet_tabs")
      .update({ is_main_tab: false })
      .eq("spreadsheet_id", existing.spreadsheet_id)
      .eq("user_id", user.id)
      .eq("is_main_tab", true)
      .neq("id", id);

    // Set this tab as main
    const { data: tab, error: updateError } = await supabase
      .from("spreadsheet_tabs")
      .update({ is_main_tab: true })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error setting main tab:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to set main tab" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tab,
    });
  } catch (error: any) {
    console.error("Set main tab error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

