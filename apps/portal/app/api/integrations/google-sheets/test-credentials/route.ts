import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { google } from "googleapis";

/**
 * POST /api/integrations/google-sheets/test-credentials
 * Test Google OAuth credentials by validating format and generating OAuth URL
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
    const { clientId, clientSecret, redirectUri } = body;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Client ID and Client Secret are required" },
        { status: 400 }
      );
    }

    const results = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
      oauthUrl: null as string | null,
    };

    // Validate Client ID format
    if (!clientId.includes('.apps.googleusercontent.com') && !/^\d+-[a-zA-Z0-9_-]+$/.test(clientId)) {
      results.valid = false;
      results.errors.push("Client ID format is invalid. Should be either <numeric>-<string>.apps.googleusercontent.com or <numeric>-<string>");
    }

    if (clientId.length < 20) {
      results.warnings.push("Client ID seems too short");
    }

    if (clientId.length > 200) {
      results.valid = false;
      results.errors.push("Client ID is too long (max 200 characters)");
    }

    // Validate Client Secret format
    if (!clientSecret.startsWith('GOCSPX-')) {
      results.warnings.push("Client Secret doesn't start with 'GOCSPX-'. This might be an older format or invalid.");
    }

    if (clientSecret.length < 20) {
      results.valid = false;
      results.errors.push("Client Secret is too short");
    }

    if (clientSecret.length > 200) {
      results.valid = false;
      results.errors.push("Client Secret is too long (max 200 characters)");
    }

    // Check for placeholder values
    if (clientSecret === 'your-secret' || clientSecret.includes('example') || clientSecret.includes('placeholder')) {
      results.valid = false;
      results.errors.push("Client Secret appears to be a placeholder value");
    }

    // Validate redirect URI format
    const finalRedirectUri = redirectUri || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/google-sheets/callback`;
    try {
      const redirectUrl = new URL(finalRedirectUri);
      if (redirectUrl.protocol !== 'https:' && redirectUrl.hostname !== 'localhost' && redirectUrl.hostname !== '127.0.0.1') {
        results.warnings.push("Redirect URI should use HTTPS in production");
      }
    } catch (e) {
      results.valid = false;
      results.errors.push(`Invalid redirect URI format: ${finalRedirectUri}`);
    }

    // Try to create OAuth2 client and generate URL
    try {
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        finalRedirectUri
      );

      const scopes = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.email',
      ];

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent',
      });

      results.oauthUrl = authUrl;
    } catch (error: any) {
      results.valid = false;
      results.errors.push(`Failed to create OAuth2 client: ${error.message}`);
    }

    // Test connectivity to Google's OAuth endpoints
    try {
      const discoveryResponse = await fetch('https://accounts.google.com/.well-known/openid-configuration');
      if (!discoveryResponse.ok) {
        results.warnings.push("Could not reach Google OAuth discovery endpoint");
      }
    } catch (error) {
      results.warnings.push("Network connectivity issue - could not verify Google OAuth endpoints");
    }

    return NextResponse.json({
      success: results.valid,
      valid: results.valid,
      errors: results.errors,
      warnings: results.warnings,
      oauthUrl: results.oauthUrl,
      message: results.valid 
        ? "Credentials are valid and ready to use!" 
        : "Credentials validation failed. Please check the errors above.",
    });
  } catch (error: any) {
    console.error("Error testing credentials:", error);
    return NextResponse.json(
      { 
        error: error.message || "Failed to test credentials",
        success: false,
        valid: false,
        errors: [error.message || "Internal server error"],
        warnings: [],
      },
      { status: 500 }
    );
  }
}

