/**
 * Supabase Credential Manager
 * 
 * Handles tenant-specific OAuth credentials stored in Supabase Secrets Management.
 * Credentials are accessed via Supabase Edge Functions which read from Supabase Secrets.
 * 
 * Usage:
 *   const manager = SupabaseCredentialManager.getInstance();
 *   const creds = await manager.getTenantOAuth(tenantId, 'google', 'individual');
 */

import { createClient } from "@/lib/database/server";

export interface TenantOAuthCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  serviceAccountEmail?: string;
  serviceAccountPrivateKey?: string;
}

export interface TenantOAuthMetadata {
  provider: string;
  credentialType: "individual" | "corporate";
  hasTenantCredentials: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export class SupabaseCredentialManager {
  private static instance: SupabaseCredentialManager;
  private cache: Map<string, TenantOAuthCredentials | null> = new Map();
  private edgeFunctionUrl: string;

  private constructor() {
    // Get Supabase URL from environment
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL environment variable is not set");
    }
    
    // Construct Edge Function URL
    // Format: https://{project-ref}.supabase.co/functions/v1/{function-name}
    const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");
    this.edgeFunctionUrl = `https://${projectRef}.supabase.co/functions/v1`;
  }

  /**
   * Get singleton instance of the credential manager
   */
  static getInstance(): SupabaseCredentialManager {
    if (!SupabaseCredentialManager.instance) {
      SupabaseCredentialManager.instance = new SupabaseCredentialManager();
    }
    return SupabaseCredentialManager.instance;
  }

  /**
   * Get Supabase service role key for Edge Function authentication
   */
  private async getServiceRoleKey(): Promise<string> {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is not set");
    }
    return serviceRoleKey;
  }

  /**
   * Call Supabase Edge Function to get tenant credentials
   */
  private async callEdgeFunction(
    functionName: string,
    body: Record<string, any>
  ): Promise<any> {
    const serviceRoleKey = await this.getServiceRoleKey();
    const url = `${this.edgeFunctionUrl}/${functionName}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(
        `Edge Function error: ${error.error || response.statusText}`
      );
    }

    return await response.json();
  }

  /**
   * Get tenant OAuth credentials from Supabase Secrets
   * Returns null if no tenant-specific credentials are found (indicates fallback needed)
   */
  async getTenantOAuth(
    tenantId: string,
    provider: string,
    credentialType: "individual" | "corporate" = "individual"
  ): Promise<TenantOAuthCredentials | null> {
    const cacheKey = `tenant_oauth_${tenantId}_${provider}_${credentialType}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) ?? null;
    }

    try {
      // Call Edge Function to get credentials
      const result = await this.callEdgeFunction("get-tenant-credentials", {
        tenant_id: tenantId,
        provider,
        credential_type: credentialType,
      });

      // If no tenant credentials found, return null (fallback to Vercel env vars)
      if (!result.has_tenant_credentials || !result.credentials) {
        this.cache.set(cacheKey, null);
        return null;
      }

      const credentials: TenantOAuthCredentials = {
        clientId: result.credentials.client_id?.trim(),
        clientSecret: result.credentials.client_secret?.trim(),
        redirectUri: result.credentials.redirect_uri?.trim() || undefined,
        serviceAccountEmail: result.credentials.service_account_email?.trim() || undefined,
        serviceAccountPrivateKey: result.credentials.service_account_private_key?.trim() || undefined,
      };

      // Cache the result
      this.cache.set(cacheKey, credentials);
      return credentials;
    } catch (error) {
      console.error(`Failed to get tenant OAuth credentials:`, error);
      // On error, return null to allow fallback
      this.cache.set(cacheKey, null);
      return null;
    }
  }

  /**
   * Save tenant OAuth credentials to Supabase Secrets
   * Note: Secrets must be set via `supabase secrets set` CLI before calling this
   */
  async saveTenantOAuth(
    tenantId: string,
    provider: string,
    credentialType: "individual" | "corporate",
    credentials: TenantOAuthCredentials
  ): Promise<void> {
    try {
      // Call Edge Function to save credential metadata
      const result = await this.callEdgeFunction("set-tenant-credentials", {
        tenant_id: tenantId,
        provider,
        credential_type: credentialType,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: credentials.redirectUri,
        service_account_email: credentials.serviceAccountEmail,
        service_account_private_key: credentials.serviceAccountPrivateKey,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to save credentials");
      }

      // Clear cache for this tenant/provider/type
      const cacheKey = `tenant_oauth_${tenantId}_${provider}_${credentialType}`;
      this.cache.delete(cacheKey);
    } catch (error) {
      console.error(`Failed to save tenant OAuth credentials:`, error);
      throw error;
    }
  }

  /**
   * Delete tenant OAuth credentials
   */
  async deleteTenantOAuth(
    tenantId: string,
    provider: string,
    credentialType: "individual" | "corporate"
  ): Promise<boolean> {
    try {
      const supabase = await createClient();
      
      // Call RPC function to soft delete
      const { error } = await supabase.rpc("delete_tenant_oauth_credentials", {
        p_tenant_id: tenantId,
        p_provider: provider,
        p_credential_type: credentialType,
      });

      if (error) {
        throw error;
      }

      // Clear cache
      const cacheKey = `tenant_oauth_${tenantId}_${provider}_${credentialType}`;
      this.cache.delete(cacheKey);

      return true;
    } catch (error) {
      console.error(`Failed to delete tenant OAuth credentials:`, error);
      return false;
    }
  }

  /**
   * Get credential metadata (without actual secret values)
   */
  async getTenantOAuthMetadata(
    tenantId: string,
    provider: string,
    credentialType: "individual" | "corporate" = "individual"
  ): Promise<TenantOAuthMetadata | null> {
    try {
      const supabase = await createClient();
      
      const { data, error } = await supabase.rpc(
        "get_tenant_oauth_credential_metadata",
        {
          p_tenant_id: tenantId,
          p_provider: provider,
          p_credential_type: credentialType,
        }
      );

      if (error || !data || data.length === 0) {
        return null;
      }

      const meta = data[0];
      return {
        provider: meta.provider,
        credentialType: meta.credential_type,
        hasTenantCredentials: true,
        createdAt: meta.created_at,
        updatedAt: meta.updated_at,
      };
    } catch (error) {
      console.error(`Failed to get tenant OAuth metadata:`, error);
      return null;
    }
  }

  /**
   * List all OAuth credentials for a tenant
   */
  async listTenantOAuthCredentials(tenantId: string): Promise<TenantOAuthMetadata[]> {
    try {
      const supabase = await createClient();
      
      const { data, error } = await supabase.rpc("list_tenant_oauth_credentials", {
        p_tenant_id: tenantId,
      });

      if (error || !data) {
        return [];
      }

      return data.map((item: any) => ({
        provider: item.provider,
        credentialType: item.credential_type,
        hasTenantCredentials: true,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));
    } catch (error) {
      console.error(`Failed to list tenant OAuth credentials:`, error);
      return [];
    }
  }

  /**
   * Clear credential cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for a specific tenant/provider/type
   */
  clearCacheFor(
    tenantId: string,
    provider: string,
    credentialType: "individual" | "corporate"
  ): void {
    const cacheKey = `tenant_oauth_${tenantId}_${provider}_${credentialType}`;
    this.cache.delete(cacheKey);
  }
}

/**
 * Convenience function to get credential manager instance
 */
export function getSupabaseCredentialManager(): SupabaseCredentialManager {
  return SupabaseCredentialManager.getInstance();
}

