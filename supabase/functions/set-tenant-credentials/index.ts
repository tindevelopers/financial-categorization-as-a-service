// Supabase Edge Function: Set Tenant OAuth Credentials
// Stores tenant-specific OAuth credentials in Supabase Secrets Management
// Note: This function updates the database metadata. Actual secrets should be
// set using `supabase secrets set` CLI command before calling this function.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SetCredentialsRequest {
  tenant_id: string;
  provider: string;
  credential_type: "individual" | "corporate";
  client_id: string;
  client_secret: string;
  redirect_uri?: string;
  service_account_email?: string;
  service_account_private_key?: string;
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
    const body: SetCredentialsRequest = await req.json();
    const {
      tenant_id,
      provider,
      credential_type,
      client_id,
      client_secret,
      redirect_uri,
      service_account_email,
      service_account_private_key,
    } = body;

    // Validate required fields
    if (!tenant_id || !provider || !credential_type || !client_id || !client_secret) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: tenant_id, provider, credential_type, client_id, client_secret",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate tenant exists
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

    // Generate secret names following naming convention
    // Format: TENANT_{tenantId}_{PROVIDER}_{TYPE}_{FIELD}
    const secretNamePrefix = `TENANT_${tenant_id.toUpperCase().replace(/-/g, "_")}_${provider.toUpperCase()}_${credential_type.toUpperCase()}`;
    const clientIdSecretName = `${secretNamePrefix}_CLIENT_ID`;
    const clientSecretSecretName = `${secretNamePrefix}_CLIENT_SECRET`;
    let serviceAccountSecretName: string | null = null;

    if (service_account_private_key) {
      serviceAccountSecretName = `${secretNamePrefix}_SERVICE_ACCOUNT_PRIVATE_KEY`;
    }

    // IMPORTANT: Secrets must be set via Supabase CLI before calling this function
    // This function only updates the database metadata
    // Check if secrets exist in environment (they should be set via `supabase secrets set`)
    const existingClientId = Deno.env.get(clientIdSecretName);
    const existingClientSecret = Deno.env.get(clientSecretSecretName);

    if (!existingClientId || !existingClientSecret) {
      return new Response(
        JSON.stringify({
          error: "Secrets must be set in Supabase Secrets Management before calling this function",
          instructions: [
            "1. Set secrets using Supabase CLI:",
            `   supabase secrets set ${clientIdSecretName}=${client_id}`,
            `   supabase secrets set ${clientSecretSecretName}=${client_secret}`,
            service_account_private_key
              ? `   supabase secrets set ${serviceAccountSecretName}=${service_account_private_key}`
              : "",
            "2. Then call this function again to update database metadata",
          ].filter(Boolean),
          secret_names: {
            client_id: clientIdSecretName,
            client_secret: clientSecretSecretName,
            service_account: serviceAccountSecretName,
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Save credential metadata to database
    const { data: credentialId, error: saveError } = await supabase.rpc(
      "save_tenant_oauth_credentials",
      {
        p_tenant_id: tenant_id,
        p_provider: provider,
        p_credential_type: credential_type,
        p_client_id_secret_name: clientIdSecretName,
        p_client_secret_secret_name: clientSecretSecretName,
        p_service_account_email: service_account_email || null,
        p_service_account_secret_name: serviceAccountSecretName,
        p_redirect_uri: redirect_uri || null,
      }
    );

    if (saveError) {
      console.error("Error saving credentials:", saveError);
      return new Response(
        JSON.stringify({
          error: "Failed to save credential metadata",
          details: saveError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        credential_id: credentialId,
        secret_names: {
          client_id: clientIdSecretName,
          client_secret: clientSecretSecretName,
          service_account: serviceAccountSecretName,
        },
        message: "Credential metadata saved successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in set-tenant-credentials:", error);
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

