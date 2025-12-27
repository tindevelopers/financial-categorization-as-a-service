#!/usr/bin/env tsx
/**
 * Script: List Tenant OAuth Secrets
 * 
 * Lists all tenant OAuth credentials stored in Supabase Secrets Management
 * 
 * Usage:
 *   tsx scripts/list-tenant-secrets.ts [tenant_id]
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listTenantSecrets(tenantId?: string) {
  console.log("📋 Tenant OAuth Credentials");
  console.log("=".repeat(60));

  try {
    let query = supabase.from("tenant_oauth_credentials").select("*").eq("is_active", true);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data: credentials, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Error fetching credentials:", error);
      return;
    }

    if (!credentials || credentials.length === 0) {
      console.log("No tenant OAuth credentials found.");
      return;
    }

    console.log(`\nFound ${credentials.length} credential set(s):\n`);

    for (const cred of credentials) {
      console.log(`Tenant ID: ${cred.tenant_id}`);
      console.log(`Provider: ${cred.provider}`);
      console.log(`Type: ${cred.credential_type}`);
      console.log(`Client ID Secret: ${cred.client_id_secret_name}`);
      console.log(`Client Secret: ${cred.client_secret_secret_name}`);
      if (cred.service_account_secret_name) {
        console.log(`Service Account Email: ${cred.service_account_email}`);
        console.log(`Service Account Secret: ${cred.service_account_secret_name}`);
      }
      console.log(`Created: ${cred.created_at}`);
      console.log(`Updated: ${cred.updated_at}`);
      console.log("-".repeat(60));
    }

    // List actual secrets from Supabase CLI
    console.log("\n📦 Supabase Secrets (from CLI):\n");
    try {
      execSync("supabase secrets list", { stdio: "inherit" });
    } catch (error) {
      console.log("Note: Run 'supabase secrets list' manually to see all secrets");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

const tenantId = process.argv[2];
listTenantSecrets(tenantId).catch(console.error);

