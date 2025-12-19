import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

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

    // Get user's cloud storage connections
    const { data: connections } = await supabase
      .from("cloud_storage_connections")
      .select("provider, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true);

    const dropbox = connections?.some(c => c.provider === "dropbox") || false;
    const google_drive = connections?.some(c => c.provider === "google_drive") || false;

    return NextResponse.json({
      success: true,
      dropbox,
      google_drive,
    });
  } catch (error: any) {
    console.error("Storage status error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
