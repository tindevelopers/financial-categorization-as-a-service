import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import crypto from "crypto";

const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY;
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET;
const DROPBOX_REDIRECT_URI = process.env.DROPBOX_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/storage/dropbox/callback`;

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

    if (!DROPBOX_APP_KEY || !DROPBOX_APP_SECRET) {
      return NextResponse.json(
        { error: "Dropbox app not configured" },
        { status: 500 }
      );
    }

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString("hex");
    
    // Store state in session/cookie (simplified - in production use secure session storage)
    const response = NextResponse.redirect(
      `https://www.dropbox.com/oauth2/authorize?client_id=${DROPBOX_APP_KEY}&redirect_uri=${encodeURIComponent(DROPBOX_REDIRECT_URI)}&response_type=code&state=${state}`
    );

    // Store state in httpOnly cookie
    response.cookies.set("dropbox_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (error: any) {
    console.error("Dropbox connect error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
