#!/usr/bin/env tsx
/**
 * Migration Script: Migrate Tenant OAuth Credentials to Supabase Secrets
 * 
 * This script migrates existing tenant OAuth credentials from the database
 * to Supabase Secrets Management.
 * 
 * Usage:
 *   tsx scripts/migrate-to-supabase-secrets.ts
 * 
 * Prerequisites:
 *   1. Supabase CLI installed and logged in
 *   2. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables set
 *   3. Database migrations applied
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import * as readline from "readline";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface TenantCredential {
  tenant_id: string;
  provider: string;
  client_id: string;
  client_secret: string;
  redirect_uri?: string;
  service_account_email?: string;
  service_account_private_key?: string;
}

/**
 * Generate secret name following naming convention
 */
function generateSecretName(
  tenantId: string,
  provider: string,
  credentialType: string,
  field: string
): string {
  const normalizedTenantId = tenantId.toUpperCase().replace(/-/g, "_");
  return `TENANT_${normalizedTenantId}_${provider.toUpperCase()}_${credentialType.toUpperCase()}_${field}`;
}

/**
 * Set secret in Supabase Secrets using CLI
 */
function setSupabaseSecret(secretName: string, secretValue: string): boolean {
  try {
    // Escape the secret value for shell
    const escapedValue = secretValue.replace(/'/g, "'\\''");
    
    // Use supabase secrets set command
    execSync(`supabase secrets set ${secretName}='${escapedValue}'`, {
      stdio: "inherit",
    });
    return true;
  } catch (error) {
    console.error(`Failed to set secret ${secretName}:`, error);
    return false;
  }
}

/**
 * Migrate credentials from tenant_integration_settings table
 */
async function migrateFromIntegrationSettings(): Promise<number> {
  console.log("\n📦 Migrating from tenant_integration_settings...");

  const { data: settings, error } = await supabase
    .from("tenant_integration_settings")
    .select("*")
    .eq("use_custom_credentials", true)
    .not("custom_client_id", "is", null)
    .not("custom_client_secret", "is", null);

  if (error) {
    console.error("Error fetching integration settings:", error);
    return 0;
  }

  if (!settings || settings.length === 0) {
    console.log("No credentials found in tenant_integration_settings");
    return 0;
  }

  let migrated = 0;

  for (const setting of settings) {
    try {
      const tenantId = setting.tenant_id;
      const provider = setting.provider === "google_sheets" ? "google" : setting.provider;
      const credentialType = "individual"; // Default to individual

      // Generate secret names
      const clientIdSecretName = generateSecretName(
        tenantId,
        provider,
        credentialType,
        "CLIENT_ID"
      );
      const clientSecretSecretName = generateSecretName(
        tenantId,
        provider,
        credentialType,
        "CLIENT_SECRET"
      );

      // Decrypt client secret if needed
      let clientSecret = setting.custom_client_secret;
      try {
        // Try to decrypt if encrypted
        const { decryptToken } = await import("../src/lib/google-sheets/auth-helpers");
        clientSecret = decryptToken(setting.custom_client_secret);
      } catch {
        // Assume plaintext if decryption fails
      }

      // Set secrets in Supabase Secrets
      console.log(`\n  Setting secrets for tenant ${tenantId}, provider ${provider}...`);
      
      const clientIdSet = setSupabaseSecret(clientIdSecretName, setting.custom_client_id);
      const clientSecretSet = setSupabaseSecret(clientSecretSecretName, clientSecret);

      if (clientIdSet && clientSecretSet) {
        // Save metadata to tenant_oauth_credentials table
        const { error: saveError } = await supabase.rpc(
          "save_tenant_oauth_credentials",
          {
            p_tenant_id: tenantId,
            p_provider: provider,
            p_credential_type: credentialType,
            p_client_id_secret_name: clientIdSecretName,
            p_client_secret_secret_name: clientSecretSecretName,
            p_service_account_email: null,
            p_service_account_secret_name: null,
            p_redirect_uri: setting.custom_redirect_uri || null,
          }
        );

        if (saveError) {
          console.error(`  ❌ Failed to save metadata:`, saveError);
        } else {
          console.log(`  ✅ Migrated credentials for tenant ${tenantId}`);
          migrated++;
        }
      } else {
        console.error(`  ❌ Failed to set secrets for tenant ${tenantId}`);
      }
    } catch (error) {
      console.error(`  ❌ Error migrating tenant ${setting.tenant_id}:`, error);
    }
  }

  return migrated;
}

/**
 * Migrate credentials from tenant_settings table (legacy)
 */
async function migrateFromTenantSettings(): Promise<number> {
  console.log("\n📦 Migrating from tenant_settings (legacy)...");

  // Check if tenant_settings table exists and has the columns
  const { data: settings, error } = await supabase
    .from("tenant_settings")
    .select("tenant_id, google_client_id, google_client_secret")
    .not("google_client_id", "is", null)
    .not("google_client_secret", "is", null);

  if (error) {
    // Table might not exist or columns might not exist
    console.log("tenant_settings table not found or doesn't have OAuth columns");
    return 0;
  }

  if (!settings || settings.length === 0) {
    console.log("No credentials found in tenant_settings");
    return 0;
  }

  let migrated = 0;

  for (const setting of settings) {
    try {
      const tenantId = setting.tenant_id;
      const provider = "google";
      const credentialType = "individual";

      // Generate secret names
      const clientIdSecretName = generateSecretName(
        tenantId,
        provider,
        credentialType,
        "CLIENT_ID"
      );
      const clientSecretSecretName = generateSecretName(
        tenantId,
        provider,
        credentialType,
        "CLIENT_SECRET"
      );

      // Decrypt client secret if needed
      let clientSecret = setting.google_client_secret;
      try {
        const { decryptToken } = await import("../src/lib/google-sheets/auth-helpers");
        clientSecret = decryptToken(setting.google_client_secret);
      } catch {
        // Assume plaintext
      }

      // Set secrets
      console.log(`\n  Setting secrets for tenant ${tenantId}...`);
      
      const clientIdSet = setSupabaseSecret(clientIdSecretName, setting.google_client_id);
      const clientSecretSet = setSupabaseSecret(clientSecretSecretName, clientSecret);

      if (clientIdSet && clientSecretSet) {
        // Save metadata
        const { error: saveError } = await supabase.rpc(
          "save_tenant_oauth_credentials",
          {
            p_tenant_id: tenantId,
            p_provider: provider,
            p_credential_type: credentialType,
            p_client_id_secret_name: clientIdSecretName,
            p_client_secret_secret_name: clientSecretSecretName,
            p_service_account_email: null,
            p_service_account_secret_name: null,
            p_redirect_uri: null,
          }
        );

        if (saveError) {
          console.error(`  ❌ Failed to save metadata:`, saveError);
        } else {
          console.log(`  ✅ Migrated credentials for tenant ${tenantId}`);
          migrated++;
        }
      }
    } catch (error) {
      console.error(`  ❌ Error migrating tenant ${setting.tenant_id}:`, error);
    }
  }

  return migrated;
}

/**
 * Main migration function
 */
async function main() {
  console.log("🚀 Tenant OAuth Credentials Migration to Supabase Secrets");
  console.log("=" .repeat(60));

  // Check if Supabase CLI is available
  try {
    execSync("supabase --version", { stdio: "pipe" });
  } catch {
    console.error("Error: Supabase CLI not found. Please install it first:");
    console.error("  npm install -g supabase");
    process.exit(1);
  }

  // Confirm migration
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question(
      "\nThis will migrate existing tenant credentials to Supabase Secrets. Continue? (yes/no): ",
      resolve
    );
  });

  rl.close();

  if (answer.toLowerCase() !== "yes") {
    console.log("Migration cancelled.");
    process.exit(0);
  }

  // Run migrations
  let totalMigrated = 0;

  totalMigrated += await migrateFromIntegrationSettings();
  totalMigrated += await migrateFromTenantSettings();

  console.log("\n" + "=".repeat(60));
  console.log(`✅ Migration complete! Migrated ${totalMigrated} tenant credential sets.`);
  console.log("\nNext steps:");
  console.log("1. Verify secrets are set: supabase secrets list");
  console.log("2. Test credential retrieval via API routes");
  console.log("3. Update any remaining code to use new credential manager");
}

// Run migration
main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

