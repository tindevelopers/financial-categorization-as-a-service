import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

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

    // Disconnect from both tables for compatibility
    const { error: error1 } = await supabase
      .from("cloud_storage_connections")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("provider", "google_sheets");

    const { error: error2 } = await supabase
      .from("user_integrations")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "google_sheets");

    if (error1 && error2) {
      console.error("Error disconnecting:", error1, error2);
      return NextResponse.json(
        { error: "Failed to disconnect" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Disconnect error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
