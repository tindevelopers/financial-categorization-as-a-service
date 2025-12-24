#!/usr/bin/env ts-node

/**
 * Test Google OAuth Credentials
 * 
 * This script validates Google OAuth Client ID and Client Secret credentials
 * by checking their format and attempting to generate a valid OAuth URL.
 * 
 * Usage:
 *   ts-node scripts/test-google-oauth-credentials.ts
 * 
 * Or with credentials:
 *   CLIENT_ID="your-client-id" CLIENT_SECRET="your-secret" ts-node scripts/test-google-oauth-credentials.ts
 */

const CLIENT_ID = process.env.CLIENT_ID || "1059004568296-mj9ftg4d5ehsa9pjrk586ukpqnb78fng";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "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";
const REDIRECT_URI = process.env.REDIRECT_URI || "http://localhost:3000/api/integrations/google-sheets/callback";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateClientId(clientId: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check format: should end with .apps.googleusercontent.com or be numeric-clientid format
  if (!clientId.includes('.apps.googleusercontent.com') && !/^\d+-[a-zA-Z0-9_-]+$/.test(clientId)) {
    errors.push("Client ID format is invalid. Should be either:\n  - <numeric>-<string>.apps.googleusercontent.com\n  - <numeric>-<string>");
  }

  // Check length
  if (clientId.length < 20) {
    warnings.push("Client ID seems too short");
  }

  if (clientId.length > 200) {
    errors.push("Client ID is too long (max 200 characters)");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateClientSecret(clientSecret: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Google OAuth secrets typically start with GOCSPX-
  if (!clientSecret.startsWith('GOCSPX-')) {
    warnings.push("Client Secret doesn't start with 'GOCSPX-'. This might be an older format or invalid.");
  }

  // Check length
  if (clientSecret.length < 20) {
    errors.push("Client Secret is too short");
  }

  if (clientSecret.length > 200) {
    errors.push("Client Secret is too long (max 200 characters)");
  }

  // Check for common invalid patterns
  if (clientSecret === 'your-secret' || clientSecret.includes('example') || clientSecret.includes('placeholder')) {
    errors.push("Client Secret appears to be a placeholder value");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function generateOAuthUrl(clientId: string, clientSecret: string, redirectUri: string): string {
  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: 'test-state-' + Date.now(),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function testCredentialsWithGoogle(clientId: string, clientSecret: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Test 1: Try to fetch Google's OAuth discovery document
    const discoveryResponse = await fetch('https://accounts.google.com/.well-known/openid-configuration');
    if (!discoveryResponse.ok) {
      errors.push(`Failed to fetch Google OAuth discovery document: ${discoveryResponse.status}`);
      return { valid: false, errors, warnings };
    }

    // Test 2: Validate redirect URI format
    try {
      const redirectUrl = new URL(REDIRECT_URI);
      if (redirectUrl.protocol !== 'https:' && redirectUrl.hostname !== 'localhost') {
        warnings.push("Redirect URI should use HTTPS in production");
      }
    } catch (e) {
      errors.push(`Invalid redirect URI format: ${REDIRECT_URI}`);
    }

    // Test 3: Generate OAuth URL (this validates the format)
    const oauthUrl = generateOAuthUrl(clientId, clientSecret, REDIRECT_URI);
    console.log("\n✅ Generated OAuth URL successfully");
    console.log(`   URL: ${oauthUrl.substring(0, 100)}...`);

    warnings.push("Note: Full OAuth flow requires user interaction and cannot be tested automatically.");
    warnings.push("To fully test, visit the OAuth URL and complete the authorization flow.");

  } catch (error: any) {
    errors.push(`Error testing credentials: ${error.message}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

async function main() {
  console.log("🔍 Testing Google OAuth Credentials\n");
  console.log("=" .repeat(60));
  console.log(`Client ID: ${CLIENT_ID.substring(0, 30)}...`);
  console.log(`Client Secret: ${CLIENT_SECRET.substring(0, 15)}...`);
  console.log(`Redirect URI: ${REDIRECT_URI}`);
  console.log("=" .repeat(60));

  // Validate Client ID
  console.log("\n📋 Validating Client ID...");
  const clientIdValidation = validateClientId(CLIENT_ID);
  if (clientIdValidation.valid) {
    console.log("✅ Client ID format is valid");
  } else {
    console.log("❌ Client ID validation failed:");
    clientIdValidation.errors.forEach(err => console.log(`   - ${err}`));
  }
  if (clientIdValidation.warnings.length > 0) {
    clientIdValidation.warnings.forEach(warn => console.log(`   ⚠️  ${warn}`));
  }

  // Validate Client Secret
  console.log("\n📋 Validating Client Secret...");
  const clientSecretValidation = validateClientSecret(CLIENT_SECRET);
  if (clientSecretValidation.valid) {
    console.log("✅ Client Secret format is valid");
  } else {
    console.log("❌ Client Secret validation failed:");
    clientSecretValidation.errors.forEach(err => console.log(`   - ${err}`));
  }
  if (clientSecretValidation.warnings.length > 0) {
    clientSecretValidation.warnings.forEach(warn => console.log(`   ⚠️  ${warn}`));
  }

  // Test with Google
  console.log("\n🌐 Testing credentials with Google OAuth...");
  const googleTest = await testCredentialsWithGoogle(CLIENT_ID, CLIENT_SECRET);
  
  if (googleTest.warnings.length > 0) {
    googleTest.warnings.forEach(warn => console.log(`   ⚠️  ${warn}`));
  }

  // Final summary
  console.log("\n" + "=" .repeat(60));
  const allErrors = [
    ...clientIdValidation.errors,
    ...clientSecretValidation.errors,
    ...googleTest.errors,
  ];

  if (allErrors.length === 0) {
    console.log("✅ All validations passed!");
    console.log("\n📝 Next steps:");
    console.log("   1. Ensure the redirect URI is added to your Google Cloud Console");
    console.log(`   2. Redirect URI should be: ${REDIRECT_URI}`);
    console.log("   3. Test the OAuth flow by visiting the generated URL");
    console.log("   4. Verify the callback endpoint handles the authorization code");
  } else {
    console.log("❌ Validation failed with errors:");
    allErrors.forEach(err => console.log(`   - ${err}`));
    process.exit(1);
  }
}

// Run the test
main().catch(error => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});

