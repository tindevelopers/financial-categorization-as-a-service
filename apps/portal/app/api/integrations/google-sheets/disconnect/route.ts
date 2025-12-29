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

    // Get connected account email before disconnecting (for logging and user feedback)
    const { data: integration } = await supabase
      .from("user_integrations")
      .select("provider_email")
      .eq("user_id", user.id)
      .eq("provider", "google_sheets")
      .single();

    const connectedEmail = integration?.provider_email || null;

    // Disconnect from both tables for compatibility - delete completely to allow fresh reconnection
    const { error: error1 } = await supabase
      .from("cloud_storage_connections")
      .delete()
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

    console.log(`Google Sheets disconnected for user ${user.id}${connectedEmail ? ` (was connected as ${connectedEmail})` : ''}`);

    return NextResponse.json({ 
      success: true,
      disconnectedAccount: connectedEmail 
    });
  } catch (error: any) {
    console.error("Disconnect error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
