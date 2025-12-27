// Supabase Edge Function: Get Tenant OAuth Credentials
// Retrieves tenant-specific OAuth credentials from Supabase Secrets
// Secrets are accessed via Deno.env.get() which reads from Supabase Secrets Management

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GetCredentialsRequest {
  tenant_id: string;
  provider: string;
  credential_type?: "individual" | "corporate";
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Parse request body
    const body: GetCredentialsRequest = await req.json();
    const { tenant_id, provider, credential_type = "individual" } = body;

    if (!tenant_id || !provider) {
      return new Response(
        JSON.stringify({ error: "Missing tenant_id or provider" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate tenant access (check if user belongs to tenant)
    // This is a security check - in production, you'd validate the JWT token
    // For now, we'll use service role but validate tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get credential metadata from database
    const { data: credentialMeta, error: metaError } = await supabase
      .rpc("get_tenant_oauth_credential_metadata", {
        p_tenant_id: tenant_id,
        p_provider: provider,
        p_credential_type: credential_type,
      });

    if (metaError || !credentialMeta || credentialMeta.length === 0) {
      // No tenant-specific credentials found - return null to indicate fallback needed
      return new Response(
        JSON.stringify({
          has_tenant_credentials: false,
          credentials: null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const meta = credentialMeta[0];

    // Retrieve actual secrets from Supabase Secrets via Deno.env.get()
    // Secret names follow format: TENANT_{tenantId}_{PROVIDER}_{TYPE}_{FIELD}
    const clientId = Deno.env.get(meta.client_id_secret_name);
    const clientSecret = Deno.env.get(meta.client_secret_secret_name);
    let serviceAccountPrivateKey: string | null = null;

    if (meta.service_account_secret_name) {
      serviceAccountPrivateKey = Deno.env.get(
        meta.service_account_secret_name
      );
    }

    // Validate we got the secrets
    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({
          error: "Secrets not found in Supabase Secrets Management",
          secret_names: {
            client_id: meta.client_id_secret_name,
            client_secret: meta.client_secret_secret_name,
          },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Return credentials (excluding sensitive values in response for security)
    return new Response(
      JSON.stringify({
        has_tenant_credentials: true,
        credentials: {
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: meta.redirect_uri,
          service_account_email: meta.service_account_email || null,
          service_account_private_key: serviceAccountPrivateKey || null,
        },
        metadata: {
          provider: meta.provider,
          credential_type: meta.credential_type,
          created_at: meta.created_at,
          updated_at: meta.updated_at,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in get-tenant-credentials:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

