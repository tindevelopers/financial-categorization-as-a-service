import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { getCredentialManager } from "@/lib/credentials/VercelCredentialManager";
import { validateOAuthConfig } from "@/lib/google-sheets/oauth-config";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      // This route is navigated to in-browser; returning JSON produces a blank page.
      // Redirect to signin with a safe return target.
      const signinUrl = new URL("/signin", request.url);
      signinUrl.searchParams.set("next", "/dashboard/integrations/google-sheets");
      return NextResponse.redirect(signinUrl.toString());
    }

    // Get tenant_id for tenant-specific credentials
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const tenantId = userData?.tenant_id || undefined;
    const force = request.nextUrl.searchParams.get("force") === "1";

    // Validate OAuth configuration
    const configValidation = await validateOAuthConfig(tenantId);

    
    if (!configValidation.isValid) {
      console.error("OAuth configuration validation failed:", configValidation.errors);
      return NextResponse.json(
        { 
          error: "Google Sheets OAuth is not properly configured",
          errors: configValidation.errors,
          warnings: configValidation.warnings,
          setupGuidance: configValidation.setupGuidance,
          expectedRedirectUri: configValidation.expectedRedirectUri,
          helpUrl: "https://console.cloud.google.com/apis/credentials",
        },
        { status: 500 }
      );
    }

    // Show warnings if any
    if (configValidation.warnings.length > 0) {
      console.warn("OAuth configuration warnings:", configValidation.warnings);
    }

    const credentialManager = getCredentialManager();

    // Check for OAuth credentials (required for user-level connections)
    // Try tenant-specific credentials first, then fall back to platform credentials
    const oauthCreds = await credentialManager.getBestGoogleOAuth(tenantId);
    
    if (!oauthCreds) {
      return NextResponse.redirect("/dashboard/integrations/google-sheets?error=no_credentials");
    }

    // Aggressively trim function (defined here to use in multiple places)
    const aggressiveTrim = (value: string | null | undefined): string => {
      if (!value) return '';
      return value.replace(/^[\s\u00A0\u2000-\u200B\u2028\u2029\u3000]+|[\s\u00A0\u2000-\u200B\u2028\u2029\u3000]+$/g, '');
    };
    
    // Use the redirect URI from credentials (which comes from GOOGLE_SHEETS_REDIRECT_URI env var)
    // This matches what's configured in Google Cloud Console and what works in Vercel
    // Fall back to computing from request origin only if not set in credentials
    const redirectUriToUse = aggressiveTrim(
      oauthCreds.redirectUri || 
      new URL("/api/integrations/google-sheets/callback", aggressiveTrim(request.nextUrl.origin)).toString()
    );


    // Log OAuth configuration for debugging
    console.log("Google Sheets OAuth Configuration:", {
      clientId: oauthCreds.clientId ? `${oauthCreds.clientId.substring(0, 20)}...` : "missing",
      redirectUri: redirectUriToUse,
      expectedRedirectUri: configValidation.expectedRedirectUri,
      tenantId: tenantId || "none",
      hasTenantCredentials: !!tenantId,
    });

    // Get account_type from query params (for future Workspace admin support)
    const searchParams = request.nextUrl.searchParams;
    const accountType = searchParams.get("account_type") || "personal"; // personal or workspace_admin

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString("hex");
    
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    
    // Use the aggressiveTrim function already defined above
    const clientIdForAuth = aggressiveTrim(oauthCreds.clientId);
    const redirectUriForAuth = aggressiveTrim(redirectUriToUse);
    
    // Log values before building auth URL (visible in Vercel logs)
    console.log('[Google Sheets Connect] Values BEFORE building auth URL:', {
      clientIdLength: clientIdForAuth.length,
      clientIdHasTrailingSpace: clientIdForAuth[clientIdForAuth.length - 1] === ' ',
      clientIdHasNewline: clientIdForAuth.includes('\n'),
      redirectUriLength: redirectUriForAuth.length,
      redirectUriHasTrailingSpace: redirectUriForAuth[redirectUriForAuth.length - 1] === ' ',
      redirectUriHasNewline: redirectUriForAuth.includes('\n'),
      redirectUri: redirectUriForAuth,
    });
    
    if (process.env.DEBUG_ENTERPRISE === "1" && user.email?.endsWith("@velocitypartners.info")) {
      console.log("[google-sheets/connect][enterprise] auth request params", {
        clientIdLength: clientIdForAuth?.length,
        clientIdHasTrailingWs:
          !!clientIdForAuth &&
          (clientIdForAuth[clientIdForAuth.length - 1] === " " ||
            clientIdForAuth[clientIdForAuth.length - 1] === "\n"),
        redirectUriForAuth,
        redirectUriLength: redirectUriForAuth.length,
        redirectUriHasTrailingWs:
          redirectUriForAuth[redirectUriForAuth.length - 1] === " " ||
          redirectUriForAuth[redirectUriForAuth.length - 1] === "\n",
        hasNewlineInMiddle: redirectUriForAuth.includes("\n"),
      });
    }
    authUrl.searchParams.set("client_id", clientIdForAuth);
    authUrl.searchParams.set("redirect_uri", redirectUriForAuth);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
      // Needed for one-click Apps Script installer (container-bound script + triggers)
      "https://www.googleapis.com/auth/script.projects",
      "https://www.googleapis.com/auth/script.scriptapp",
      "https://www.googleapis.com/auth/userinfo.email"
    ].join(" "));
    authUrl.searchParams.set("access_type", "offline"); // Get refresh token
    authUrl.searchParams.set("prompt", "consent"); // Force consent to get refresh token
    authUrl.searchParams.set("state", state);


    // Log the OAuth URL (without sensitive data) for debugging
    console.log("OAuth URL generated:", {
      baseUrl: authUrl.origin + authUrl.pathname,
      redirectUri: authUrl.searchParams.get("redirect_uri"),
      scopes: authUrl.searchParams.get("scope")?.split(" "),
      hasClientId: !!authUrl.searchParams.get("client_id"),
    });

    // Store account_type in state for callback (encode in cookie)
    const response = NextResponse.redirect(authUrl.toString());

    // Store state and account_type in httpOnly cookies
    response.cookies.set("google_sheets_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
    });

    response.cookies.set("google_sheets_account_type", accountType, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
    });

    // Store the redirect URI we used so callback can exchange tokens with the same redirect URI.
    response.cookies.set("google_sheets_redirect_uri", redirectUriToUse, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
    });

    console.log(`Initiating Google Sheets OAuth flow for user ${user.id}, account_type: ${accountType}`);

    return response;
  } catch (error: any) {
    console.error("Google Sheets connect error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

