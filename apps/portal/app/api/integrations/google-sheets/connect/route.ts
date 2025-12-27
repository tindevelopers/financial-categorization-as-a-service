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

    // Deterministic redirect URI: derive from the actual request origin so we never drift by port/env.
    const requestOriginRaw = request.nextUrl.origin;
    // #region agent log - Check request origin for whitespace
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/integrations/google-sheets/connect/route.ts:computedRedirectUri',message:'Request origin before URL construction',data:{requestOriginRaw,requestOriginLength:requestOriginRaw.length,hasTrailingWs:requestOriginRaw[requestOriginRaw.length-1]===' '||requestOriginRaw[requestOriginRaw.length-1]==='\n'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    const computedRedirectUri = new URL(
      "/api/integrations/google-sheets/callback",
      requestOriginRaw.trim()
    ).toString().trim();
    // #region agent log - Check computed redirect URI after URL construction
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/integrations/google-sheets/connect/route.ts:computedRedirectUri:after',message:'Computed redirect URI after URL construction',data:{computedRedirectUri,computedRedirectUriLength:computedRedirectUri.length,hasTrailingWs:computedRedirectUri[computedRedirectUri.length-1]===' '||computedRedirectUri[computedRedirectUri.length-1]==='\n'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    // In development, run a user-visible preflight once per click unless explicitly forced.
    // This avoids repeatedly dumping users onto Google's opaque redirect_uri_mismatch error page.
    if (!force && process.env.NODE_ENV !== "production") {
      const url = new URL("/dashboard/integrations/google-sheets", request.url);
      url.searchParams.set("error", "preflight_redirect");
      url.searchParams.set("expected_redirect_uri", computedRedirectUri);
      url.searchParams.set("continue_url", "/api/integrations/google-sheets/connect?force=1");
      url.searchParams.set("help_url", "https://console.cloud.google.com/apis/credentials");
      return NextResponse.redirect(url.toString());
    }

    // Preflight: if env/config redirect URI differs from the request-derived one, show the user
    // exactly what to whitelist in Google Cloud Console (and offer a “continue anyway”).
    if (!force && oauthCreds.redirectUri && oauthCreds.redirectUri !== computedRedirectUri) {
      const url = new URL("/dashboard/integrations/google-sheets", request.url);
      url.searchParams.set("error", "redirect_uri_mismatch");
      url.searchParams.set("expected_redirect_uri", computedRedirectUri);
      url.searchParams.set("used_redirect_uri", oauthCreds.redirectUri);
      url.searchParams.set("continue_url", "/api/integrations/google-sheets/connect?force=1");
      url.searchParams.set("help_url", "https://console.cloud.google.com/apis/credentials");
      return NextResponse.redirect(url.toString());
    }

    // If env/config redirectUri differs, we proceed using the computed redirect URI.
    // This avoids the “redirect_uri_mismatch” loop caused by 3000/3002/env drift.
    if (oauthCreds.redirectUri && oauthCreds.redirectUri !== computedRedirectUri) {
      console.warn("Google Sheets OAuth redirectUri differs from request-derived redirectUri. Using request-derived value.", {
        configuredRedirectUri: oauthCreds.redirectUri,
        computedRedirectUri,
        tenantId: tenantId || "none",
      });
    }

    // Log OAuth configuration for debugging
    console.log("Google Sheets OAuth Configuration:", {
      clientId: oauthCreds.clientId ? `${oauthCreds.clientId.substring(0, 20)}...` : "missing",
      redirectUri: computedRedirectUri,
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
    const clientIdForAuth = oauthCreds.clientId?.trim();
    const redirectUriForAuth = computedRedirectUri.trim();
    // #region agent log - Check values being sent to Google OAuth
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/integrations/google-sheets/connect/route.ts:authUrl:before',message:'Values being sent to Google OAuth',data:{clientIdForAuth,clientIdLength:clientIdForAuth?.length,clientIdHasTrailingWs:clientIdForAuth?.[clientIdForAuth.length-1]===' '||clientIdForAuth?.[clientIdForAuth.length-1]==='\n',redirectUriForAuth,redirectUriLength:redirectUriForAuth.length,redirectUriHasTrailingWs:redirectUriForAuth[redirectUriForAuth.length-1]===' '||redirectUriForAuth[redirectUriForAuth.length-1]==='\n',hasNewlineInMiddle:redirectUriForAuth.includes('\n')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    authUrl.searchParams.set("client_id", clientIdForAuth);
    authUrl.searchParams.set("redirect_uri", redirectUriForAuth);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
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
    response.cookies.set("google_sheets_redirect_uri", computedRedirectUri, {
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

