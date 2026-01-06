import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { getCredentialManager } from "@/lib/credentials/VercelCredentialManager";
import { getOAuthErrorGuidance } from "@/lib/google-sheets/oauth-config";
import { google } from "googleapis";
import crypto from "crypto";

function encrypt(text: string, key: string): string {
  const algorithm = "aes-256-cbc";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    algorithm,
    Buffer.from(key, "hex"),
    iv
  );
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(encryptedText: string, key: string): string {
  const parts = encryptedText.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted text format");
  }
  const [ivHex, ciphertext] = parts;
  const algorithm = "aes-256-cbc";
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(
    algorithm,
    Buffer.from(key, "hex"),
    iv
  );
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      const unauthorizedUrl = new URL("/dashboard/integrations/google-sheets", request.url);
      unauthorizedUrl.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(unauthorizedUrl.toString());
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    const storedState = request.cookies.get("google_sheets_oauth_state")?.value;
    const accountType = request.cookies.get("google_sheets_account_type")?.value || "personal";
    const redirectUriCookie = request.cookies.get("google_sheets_redirect_uri")?.value;


    // Get tenant_id first (needed for credential lookup)
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    // Get OAuth credentials for logging error details
    const credentialManager = getCredentialManager();
    const oauthCredsForError = await credentialManager.getBestGoogleOAuth(userData?.tenant_id || undefined);

    // Validate OAuth config for debugging
    const { validateOAuthConfig } = await import("@/lib/google-sheets/oauth-config");
    const configValidationForError = await validateOAuthConfig(userData?.tenant_id || undefined);

    // Handle OAuth errors from Google
    if (errorParam) {
      const guidance = getOAuthErrorGuidance(
        errorParam,
        errorDescription || undefined,
        configValidationForError?.expectedRedirectUri
      );
      console.error(`OAuth error from Google: ${errorParam}`, {
        errorDescription,
        guidance,
        requestUrl: request.url,
        searchParams: Object.fromEntries(searchParams.entries()),
        redirectUriUsed: oauthCredsForError?.redirectUri || "unknown",
        expectedRedirectUri: configValidationForError?.expectedRedirectUri,
        clientId: oauthCredsForError?.clientId ? `${oauthCredsForError.clientId.substring(0, 20)}...` : "missing",
      });

      // Redirect with detailed error information
      const errorUrl = new URL("/dashboard/integrations/google-sheets", request.url);
      errorUrl.searchParams.set("error", errorParam);
      errorUrl.searchParams.set("error_description", errorDescription || guidance.message);
      errorUrl.searchParams.set("help_url", guidance.helpUrl || "");
      if (configValidationForError?.expectedRedirectUri) {
        errorUrl.searchParams.set("expected_redirect_uri", configValidationForError.expectedRedirectUri);
      }
      if (oauthCredsForError?.redirectUri) {
        errorUrl.searchParams.set("used_redirect_uri", oauthCredsForError.redirectUri);
      }
      if (redirectUriCookie) {
        errorUrl.searchParams.set("request_redirect_uri", redirectUriCookie);
      }

      return NextResponse.redirect(errorUrl.toString());
    }

    // Verify state
    if (!state || state !== storedState) {
      console.error("OAuth state mismatch", { state, storedState });
      const stateErrorUrl = new URL("/dashboard/integrations/google-sheets", request.url);
      stateErrorUrl.searchParams.set("error", "invalid_state");
      return NextResponse.redirect(stateErrorUrl.toString());
    }

    if (!code) {
      console.error("OAuth callback missing authorization code");
      const codeErrorUrl = new URL("/dashboard/integrations/google-sheets", request.url);
      codeErrorUrl.searchParams.set("error", "no_code");
      return NextResponse.redirect(codeErrorUrl.toString());
    }

    // Get OAuth credentials from credential manager (prefers tenant-specific if available)
    const oauthCreds = await credentialManager.getBestGoogleOAuth(userData?.tenant_id || undefined);

    if (!oauthCreds) {
      console.error("OAuth callback: No credentials found", {
        tenantId: userData?.tenant_id || null,
      });
      const noCredsUrl = new URL("/dashboard/integrations/google-sheets", request.url);
      noCredsUrl.searchParams.set("error", "no_credentials");
      return NextResponse.redirect(noCredsUrl.toString());
    }


    // Validate OAuth config for debugging
    const configValidation = await validateOAuthConfig(userData?.tenant_id || undefined);

    console.log("OAuth callback received:", {
      hasCode: !!code,
      hasState: !!state,
      redirectUri: oauthCreds.redirectUri,
      expectedRedirectUri: configValidation.expectedRedirectUri,
      redirectUriMatch: oauthCreds.redirectUri === configValidation.expectedRedirectUri,
      redirectUriCookie,
      requestUrl: request.url,
    });

    // Aggressively trim function (defined here to use in multiple places)
    const aggressiveTrim = (value: string | null | undefined): string => {
      if (!value) return '';
      return value.replace(/^[\s\u00A0\u2000-\u200B\u2028\u2029\u3000]+|[\s\u00A0\u2000-\u200B\u2028\u2029\u3000]+$/g, '');
    };
    
    // Use the redirect URI we actually used in the authorize request (stored in cookie),
    // otherwise derive from this request origin (avoids env drift), and only then fall back.
    // Aggressively trim any whitespace/newlines that might have been introduced from env vars
    const redirectUriForTokenExchange = aggressiveTrim(
      redirectUriCookie ||
      new URL("/api/integrations/google-sheets/callback", aggressiveTrim(request.nextUrl.origin)).toString() ||
      oauthCreds.redirectUri
    );
    // Log detailed OAuth configuration for debugging invalid_client errors
    console.log("OAuth token exchange configuration:", {
      clientId: oauthCreds.clientId ? `${oauthCreds.clientId.substring(0, 20)}...` : "missing",
      clientIdLength: oauthCreds.clientId?.length || 0,
      hasClientSecret: !!oauthCreds.clientSecret,
      clientSecretLength: oauthCreds.clientSecret?.length || 0,
      redirectUriForTokenExchange,
      redirectUriLength: redirectUriForTokenExchange.length,
      redirectUriCookie,
      oauthCredsRedirectUri: oauthCreds.redirectUri,
      requestOrigin: request.nextUrl.origin,
      tenantId: userData?.tenant_id || "none",
    });

    // Exchange code for tokens using googleapis
    // Aggressively trim all values to remove any whitespace (including Unicode whitespace)
    const clientIdForTokenExchange = aggressiveTrim(oauthCreds.clientId);
    const clientSecretForTokenExchange = aggressiveTrim(oauthCreds.clientSecret);
    const redirectUriForTokenExchangeFinal = aggressiveTrim(redirectUriForTokenExchange);

    // Log values before token exchange (visible in Vercel logs)
    console.log('[Google Sheets Callback] Values BEFORE token exchange:', {
      clientIdLength: clientIdForTokenExchange.length,
      clientIdHasTrailingSpace: clientIdForTokenExchange[clientIdForTokenExchange.length - 1] === ' ',
      clientIdHasNewline: clientIdForTokenExchange.includes('\n'),
      clientSecretLength: clientSecretForTokenExchange.length,
      clientSecretHasTrailingSpace: clientSecretForTokenExchange[clientSecretForTokenExchange.length - 1] === ' ',
      clientSecretHasNewline: clientSecretForTokenExchange.includes('\n'),
      redirectUriLength: redirectUriForTokenExchangeFinal.length,
      redirectUriHasTrailingSpace: redirectUriForTokenExchangeFinal[redirectUriForTokenExchangeFinal.length - 1] === ' ',
      redirectUriHasNewline: redirectUriForTokenExchangeFinal.includes('\n'),
      redirectUri: redirectUriForTokenExchangeFinal,
    });

    const oauth2Client = new google.auth.OAuth2(
      clientIdForTokenExchange,
      clientSecretForTokenExchange,
      redirectUriForTokenExchangeFinal
    );

    let tokens;
    try {
      console.log('[Google Sheets Callback] About to call getToken:', {
        hasCode: !!code,
        codeLength: code?.length || 0,
      });
      const tokenResponse = await oauth2Client.getToken(code);
      tokens = tokenResponse.tokens;
      console.log('[Google Sheets Callback] Token exchange SUCCESS:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
      });
    } catch (tokenError: any) {
      console.error('[Google Sheets Callback] Token exchange FAILED:', {
        errorMessage: tokenError?.message || 'unknown',
        errorCode: tokenError?.code || 'unknown',
        errorStatus: tokenError?.status || 'unknown',
        clientIdLength: clientIdForTokenExchange.length,
        clientSecretLength: clientSecretForTokenExchange.length,
        redirectUriLength: redirectUriForTokenExchangeFinal.length,
        redirectUri: redirectUriForTokenExchangeFinal,
      });
      console.error("Failed to exchange authorization code for tokens:", tokenError);


      // Extract error details
      const errorMessage: string = tokenError?.message || "Failed to obtain access token";
      let errorCode: string =
        typeof tokenError?.code === "string"
          ? tokenError.code
          : "token_exchange_failed";

      // googleapis often surfaces token endpoint failures as numeric HTTP status codes.
      // Map common cases to Google OAuth error strings so the UI renders the right guidance.
      if (typeof tokenError?.code === "number") {
        const msg = (errorMessage || "").toLowerCase();
        if (msg.includes("invalid_client")) errorCode = "invalid_client";
        else if (msg.includes("redirect_uri_mismatch")) errorCode = "redirect_uri_mismatch";
        else if (msg.includes("invalid_grant")) errorCode = "invalid_grant";
        else errorCode = "token_exchange_failed";
      }

      const guidance = getOAuthErrorGuidance(
        errorCode,
        errorMessage,
        configValidation?.expectedRedirectUri
      );

      const errorUrl = new URL("/dashboard/integrations/google-sheets", request.url);
      errorUrl.searchParams.set("error", errorCode);
      errorUrl.searchParams.set("error_description", guidance.message);
      errorUrl.searchParams.set("help_url", guidance.helpUrl || "");
      if (configValidation?.expectedRedirectUri) {
        errorUrl.searchParams.set("expected_redirect_uri", configValidation.expectedRedirectUri);
      }
      if (oauthCreds?.redirectUri) {
        errorUrl.searchParams.set("used_redirect_uri", oauthCreds.redirectUri);
      }


      return NextResponse.redirect(errorUrl.toString());
    }

    if (!tokens.access_token) {
      console.error("No access token in token response");
      const noTokenUrl = new URL("/dashboard/integrations/google-sheets", request.url);
      noTokenUrl.searchParams.set("error", "no_access_token");
      return NextResponse.redirect(noTokenUrl.toString());
    }


    // Get user info to get email and detect workspace domain
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    let userInfo;
    try {
      userInfo = await oauth2.userinfo.get();
    } catch (userInfoError: any) {
      console.error("Failed to get user info:", userInfoError);
      // Continue without user info - we can still store tokens
    }

    const providerEmail = userInfo?.data?.email || null;

    // Detect if this is a Google Workspace account (domain != gmail.com or googlemail.com)
    const emailDomain = providerEmail?.split("@")[1] || null;
    const isWorkspaceAccount = emailDomain &&
      emailDomain !== "gmail.com" &&
      emailDomain !== "googlemail.com";

    // Extract workspace domain if applicable
    const workspaceDomain = isWorkspaceAccount ? emailDomain : null;

    // Determine account type based on account_type cookie or workspace detection
    const finalAccountType = accountType === "workspace_admin" || isWorkspaceAccount
      ? "workspace_admin"
      : "personal";

    // Encrypt tokens before storing
    const encryptionKey = process.env.ENCRYPTION_KEY;    if (!encryptionKey) {
      console.error("ENCRYPTION_KEY not configured");      const configErrorUrl = new URL("/dashboard/integrations/google-sheets", request.url);
      configErrorUrl.searchParams.set("error", "configuration_error");
      return NextResponse.redirect(configErrorUrl.toString());
    }

    const encryptedAccessToken = encrypt(tokens.access_token, encryptionKey);
    const encryptedRefreshToken = tokens.refresh_token
      ? encrypt(tokens.refresh_token, encryptionKey)
      : null;


    // Calculate expiration
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : tokens.access_token
        ? new Date(Date.now() + 3600 * 1000) // Default 1 hour
        : null;

    // Store connection in database - try both tables for compatibility
    console.log("Storing connection in cloud_storage_connections...", {
      user_id: user.id,
      tenant_id: userData?.tenant_id || null,
      provider: "google_sheets",
      hasAccessToken: !!encryptedAccessToken,
      hasRefreshToken: !!encryptedRefreshToken,
      accountType: finalAccountType,
    });

    const { error: insertError1, data: insertData1 } = await supabase
      .from("cloud_storage_connections")
      .upsert({
        user_id: user.id,
        tenant_id: userData?.tenant_id || null,
        provider: "google_sheets",
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_expires_at: expiresAt,
        is_active: true,
        account_type: finalAccountType,
        workspace_domain: workspaceDomain,
        is_workspace_admin: isWorkspaceAccount,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,provider",
      });

    console.log("cloud_storage_connections insert result:", {
      error: insertError1,
      hasData: !!insertData1,
      });

    // Also store in user_integrations for compatibility
    console.log("Storing connection in user_integrations...", {
      user_id: user.id,
      provider: "google_sheets",
      provider_email: providerEmail,
    });

    // Note: user_integrations uses token_expires_at not expires_at
    const { error: insertError2, data: insertData2 } = await supabase
      .from("user_integrations")
      .upsert({
        user_id: user.id,
        provider: "google_sheets",
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        provider_email: providerEmail,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,provider",
      });

    console.log("user_integrations insert result:", {
      error: insertError2,
      hasData: !!insertData2,
    });

    console.log(`Google Sheets connected for user ${user.id}`, {
      email: providerEmail,
      accountType: finalAccountType,
      workspaceDomain,
      isWorkspaceAccount,
      insertError1: insertError1?.message || null,
      insertError2: insertError2?.message || null,
      });

    if (insertError1 && insertError2) {
      console.error("Database insert errors:", {
        cloud_storage_connections: insertError1,
        user_integrations: insertError2,
      });
      const dbErrorUrl = new URL("/dashboard/integrations/google-sheets", request.url);
      dbErrorUrl.searchParams.set("error", "database_error");
      return NextResponse.redirect(dbErrorUrl.toString());
    }

    if (insertError1) {
      console.warn("cloud_storage_connections insert failed, but user_integrations succeeded:", insertError1);
    }

    if (insertError2) {
      console.warn("user_integrations insert failed, but cloud_storage_connections succeeded:", insertError2);
    }

    // Clear state and account_type cookies
    const successUrl = new URL("/dashboard/integrations/google-sheets", request.url);
    successUrl.searchParams.set("connected", "true");


    const response = NextResponse.redirect(successUrl.toString());
    response.cookies.delete("google_sheets_oauth_state");
    response.cookies.delete("google_sheets_account_type");
    response.cookies.delete("google_sheets_redirect_uri");

    return response;
  } catch (error: any) {
    console.error("Google Sheets callback error:", error);
    const callbackErrorUrl = new URL("/dashboard/integrations/google-sheets", request.url);
    callbackErrorUrl.searchParams.set("error", "callback_failed");
    return NextResponse.redirect(callbackErrorUrl.toString());
  }
}
