/**
 * OAuth Configuration Helper
 * 
 * Validates OAuth app configuration, checks redirect URIs, and provides setup guidance
 */

import { getCredentialManager } from "@/lib/credentials/VercelCredentialManager";

export interface OAuthConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  redirectUri?: string;
  expectedRedirectUri?: string;
  setupGuidance?: string[];
}

/**
 * Validate OAuth app configuration
 */
export async function validateOAuthConfig(tenantId?: string): Promise<OAuthConfigValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const setupGuidance: string[] = [];

  try {
    const credentialManager = getCredentialManager();
    const oauthCreds = await credentialManager.getBestGoogleOAuth(tenantId);

    if (!oauthCreds) {
      errors.push("Google OAuth credentials are not configured");
      setupGuidance.push(
        "1. Go to Google Cloud Console (https://console.cloud.google.com/apis/credentials)",
        "2. Create OAuth 2.0 Client ID credentials",
        "3. Set application type to 'Web application'",
        "4. Add authorized redirect URIs",
        "5. Configure credentials in Supabase Secrets or Vercel environment variables"
      );
      return {
        isValid: false,
        errors,
        warnings,
        setupGuidance,
      };
    }

    // Validate redirect URI format
    const redirectUri = oauthCreds.redirectUri;
    if (!redirectUri) {
      errors.push("Redirect URI is not configured");
    } else {
      // Check if redirect URI is a valid URL
      try {
        new URL(redirectUri);
      } catch {
        errors.push(`Invalid redirect URI format: ${redirectUri}`);
      }

      // Check if redirect URI uses HTTPS in production
      if (process.env.NODE_ENV === "production" && !redirectUri.startsWith("https://")) {
        warnings.push("Redirect URI should use HTTPS in production");
      }
    }

    // Expected redirect URI for Google Sheets
    // Portal app runs on port 3002 by default
    const defaultPort = process.env.PORT || '3002';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${defaultPort}`);
    const expectedRedirectUri = `${baseUrl}/api/integrations/google-sheets/callback`;

    if (redirectUri && redirectUri !== expectedRedirectUri) {
      warnings.push(
        `Redirect URI mismatch. Expected: ${expectedRedirectUri}, Got: ${redirectUri}`,
        "Make sure the redirect URI in Google Cloud Console matches the expected value"
      );
    }

    // Check if client ID and secret are present
    if (!oauthCreds.clientId) {
      errors.push("Google OAuth Client ID is missing");
    }

    if (!oauthCreds.clientSecret) {
      errors.push("Google OAuth Client Secret is missing");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      redirectUri,
      expectedRedirectUri,
      setupGuidance: errors.length > 0 ? setupGuidance : undefined,
    };
  } catch (error: any) {
    errors.push(`Failed to validate OAuth configuration: ${error.message}`);
    return {
      isValid: false,
      errors,
      warnings,
      setupGuidance,
    };
  }
}

/**
 * Get OAuth error guidance based on error code
 */
export function getOAuthErrorGuidance(errorCode: string, errorDescription?: string): {
  message: string;
  actionableSteps: string[];
  helpUrl?: string;
} {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3002');
  const expectedRedirectUri = `${baseUrl}/api/integrations/google-sheets/callback`;

  switch (errorCode) {
    case "invalid_request":
      return {
        message: "The OAuth request is invalid. This usually means the redirect URI doesn't match what's configured in Google Cloud Console.",
        actionableSteps: [
          "1. Go to Google Cloud Console: https://console.cloud.google.com/apis/credentials",
          `2. Find your OAuth 2.0 Client ID`,
          `3. Add this exact redirect URI to 'Authorized redirect URIs': ${expectedRedirectUri}`,
          "4. Save the changes",
          "5. Try connecting again",
        ],
        helpUrl: "https://console.cloud.google.com/apis/credentials",
      };

    case "redirect_uri_mismatch":
      return {
        message: "The redirect URI in the request doesn't match any authorized redirect URIs configured in Google Cloud Console.",
        actionableSteps: [
          "1. Go to Google Cloud Console: https://console.cloud.google.com/apis/credentials",
          `2. Find your OAuth 2.0 Client ID`,
          `3. Add this exact redirect URI: ${expectedRedirectUri}`,
          "4. Make sure there are no trailing slashes or extra characters",
          "5. Save and try again",
        ],
        helpUrl: "https://console.cloud.google.com/apis/credentials",
      };

    case "access_denied":
      return {
        message: "You denied access to the application. Please grant the required permissions.",
        actionableSteps: [
          "1. Click 'Connect with Google' again",
          "2. Review the permissions requested",
          "3. Click 'Allow' to grant access",
        ],
      };

    case "invalid_client":
      return {
        message: "The OAuth client ID or secret is invalid or not configured correctly.",
        actionableSteps: [
          "1. Verify OAuth credentials are configured in Supabase Secrets or Vercel environment variables",
          "2. Check that the Client ID and Client Secret match your Google Cloud Console settings",
          "3. Contact your administrator if credentials need to be updated",
        ],
        helpUrl: "https://console.cloud.google.com/apis/credentials",
      };

    case "invalid_grant":
      return {
        message: "The authorization code has expired or is invalid. Please try connecting again.",
        actionableSteps: [
          "1. Click 'Disconnect' to clear the current connection",
          "2. Click 'Connect with Google' to start fresh",
        ],
      };

    default:
      return {
        message: errorDescription || "An OAuth error occurred. Please try again or contact support.",
        actionableSteps: [
          "1. Try disconnecting and reconnecting",
          "2. Check that your Google account has access to Google Sheets",
          "3. Contact support if the issue persists",
        ],
      };
  }
}

/**
 * Check if OAuth app needs verification
 */
export function checkOAuthVerificationStatus(): {
  needsVerification: boolean;
  guidance: string[];
} {
  // Google requires OAuth app verification for:
  // - Apps with sensitive scopes
  // - Apps with more than 100 users
  // - Apps requesting access to user data

  const guidance: string[] = [
    "If you see 'Access blocked: Authorization Error', your OAuth app may need verification",
    "Google requires app verification for sensitive scopes like Google Sheets access",
    "To verify your app:",
    "1. Go to Google Cloud Console > OAuth consent screen",
    "2. Complete the verification process",
    "3. Submit your app for review if required",
    "For testing, you can add test users in the OAuth consent screen without verification",
  ];

  return {
    needsVerification: false, // This would need to be checked via API
    guidance,
  };
}

