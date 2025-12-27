/**
 * Vercel Credential Manager
 * 
 * Centralized credential management that leverages Vercel's secure environment variables
 * for core system credentials and Supabase Secrets Management for tenant-specific credentials.
 * 
 * This manager provides:
 * - Centralized access to all credentials
 * - Type-safe credential retrieval
 * - Fallback mechanisms (Supabase Secrets -> Vercel env vars)
 * - Support for both individual and corporate tenant credentials
 * 
 * Usage:
 *   const credentials = await VercelCredentialManager.getInstance();
 *   const googleOAuth = await credentials.getBestGoogleOAuth(tenantId);
 */

import { 
  getSupabaseCredentialManager,
  type TenantOAuthCredentials as SupabaseTenantOAuthCredentials 
} from './SupabaseCredentialManager';

export interface GoogleOAuthCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleServiceAccountCredentials {
  email: string;
  privateKey: string;
}

export interface TenantOAuthCredentials {
  clientId: string;
  clientSecret: string;
}

export class VercelCredentialManager {
  private static instance: VercelCredentialManager;
  private cache: Map<string, any> = new Map();

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance of the credential manager
   */
  static getInstance(): VercelCredentialManager {
    if (!VercelCredentialManager.instance) {
      VercelCredentialManager.instance = new VercelCredentialManager();
    }
    return VercelCredentialManager.instance;
  }

  /**
   * Get Google OAuth credentials from Vercel environment variables
   * These are platform-level credentials used for user OAuth flows
   */
  async getGoogleOAuth(): Promise<GoogleOAuthCredentials | null> {
    const cacheKey = 'google_oauth';
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    
    if (!clientId || !clientSecret) {
      return null;
    }

    // Construct redirect URI
    // Portal app runs on port 3002 by default
    const defaultPort = process.env.PORT || '3002';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : `http://localhost:${defaultPort}`);
    const redirectUri = (process.env.GOOGLE_SHEETS_REDIRECT_URI?.trim() || 
      process.env.GOOGLE_REDIRECT_URI?.trim() || 
      `${baseUrl}/api/integrations/google-sheets/callback`).trim();

    const credentials: GoogleOAuthCredentials = {
      clientId,
      clientSecret,
      redirectUri,
    };

    this.cache.set(cacheKey, credentials);
    return credentials;
  }

  /**
   * Check if Google OAuth credentials are available
   */
  async hasGoogleOAuth(): Promise<boolean> {
    const creds = await this.getGoogleOAuth();
    return creds !== null;
  }

  /**
   * Get Google Service Account credentials from Vercel environment variables
   * These are used for server-level access (corporate/company accounts)
   */
  async getGoogleServiceAccount(): Promise<GoogleServiceAccountCredentials | null> {
    const cacheKey = 'google_service_account';
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (!email || !privateKey) {
      return null;
    }

    // Normalize private key (handle escaped newlines)
    const normalizedPrivateKey = privateKey.replace(/\\n/g, '\n');

    const credentials: GoogleServiceAccountCredentials = {
      email,
      privateKey: normalizedPrivateKey,
    };

    this.cache.set(cacheKey, credentials);
    return credentials;
  }

  /**
   * Check if Google Service Account credentials are available
   */
  async hasGoogleServiceAccount(): Promise<boolean> {
    const creds = await this.getGoogleServiceAccount();
    return creds !== null;
  }

  /**
   * Get tenant-specific OAuth credentials from Supabase Secrets Management
   * Falls back to legacy database storage if Supabase Secrets not available
   */
  async getTenantOAuth(
    tenantId: string,
    provider: string = 'google',
    credentialType: 'individual' | 'corporate' = 'individual'
  ): Promise<TenantOAuthCredentials | null> {
    const cacheKey = `tenant_oauth_${tenantId}_${provider}_${credentialType}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // First, try Supabase Secrets Management
      const supabaseManager = getSupabaseCredentialManager();
      const supabaseCreds = await supabaseManager.getTenantOAuth(
        tenantId,
        provider,
        credentialType
      );

      if (supabaseCreds) {
        const credentials: TenantOAuthCredentials = {
          clientId: supabaseCreds.clientId,
          clientSecret: supabaseCreds.clientSecret,
        };
        this.cache.set(cacheKey, credentials);
        return credentials;
      }

      // Fallback to legacy database storage (for backward compatibility)
      try {
      const { createClient } = await import('@/lib/database/server');
      const supabase = await createClient();

      const { data: settings, error } = await supabase
        .from('tenant_settings')
        .select('google_client_id, google_client_secret')
        .eq('tenant_id', tenantId)
        .eq('use_custom_credentials', true)
        .single();

      if (error || !settings) {
        return null;
      }

      if (!settings.google_client_id || !settings.google_client_secret) {
        return null;
      }

        // Decrypt credentials if needed
      let clientId: string;
      let clientSecret: string;

      try {
          const { decryptToken } = await import('@/lib/google-sheets/auth-helpers');
        clientId = decryptToken(settings.google_client_id);
        clientSecret = decryptToken(settings.google_client_secret);
      } catch {
        clientId = settings.google_client_id;
        clientSecret = settings.google_client_secret;
      }

      const credentials: TenantOAuthCredentials = {
        clientId,
        clientSecret,
      };

      this.cache.set(cacheKey, credentials);
      return credentials;
      } catch (legacyError) {
        console.error('Failed to get legacy tenant OAuth credentials:', legacyError);
        return null;
      }
    } catch (error) {
      console.error('Failed to get tenant OAuth credentials:', error);
      return null;
    }
  }

  /**
   * Check if tenant has custom OAuth credentials
   */
  async hasTenantOAuth(
    tenantId: string,
    provider: string = 'google',
    credentialType: 'individual' | 'corporate' = 'individual'
  ): Promise<boolean> {
    const creds = await this.getTenantOAuth(tenantId, provider, credentialType);
    return creds !== null;
  }

  /**
   * Get the best available Google OAuth credentials
   * Priority: Tenant-specific credentials (Supabase Secrets) > Platform credentials (Vercel env vars)
   */
  async getBestGoogleOAuth(
    tenantId?: string,
    credentialType: 'individual' | 'corporate' = 'individual'
  ): Promise<GoogleOAuthCredentials | null> {
    // Construct default redirect URI (used if tenant doesn't have custom_redirect_uri)
    const defaultPort = process.env.PORT || '3002';
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : `http://localhost:${defaultPort}`)).trim();
    const defaultRedirectUri = (process.env.GOOGLE_SHEETS_REDIRECT_URI?.trim() || 
      process.env.GOOGLE_REDIRECT_URI?.trim() || 
      `${baseUrl}/api/integrations/google-sheets/callback`).trim();

    // Try tenant-specific credentials first if tenantId is provided
    if (tenantId) {
      // Try corporate credentials first if requested
      if (credentialType === 'corporate') {
        const corporateCreds = await this.getTenantOAuth(tenantId, 'google', 'corporate');
        if (corporateCreds) {
          // Check for custom_redirect_uri in database (similar to auth-url route)
          let customRedirectUri: string | undefined;
          try {
            const { createClient } = await import('@/lib/database/server');
            const supabase = await createClient();
            const { data: tenantSettings } = await supabase
              .from('tenant_integration_settings')
              .select('custom_redirect_uri')
              .eq('tenant_id', tenantId)
              .eq('provider', 'google_sheets')
              .eq('use_custom_credentials', true)
              .single();
            
            if (tenantSettings?.custom_redirect_uri) {
              customRedirectUri = tenantSettings.custom_redirect_uri.trim();
            }
          } catch (error) {
            console.warn('Failed to get custom_redirect_uri from database, using default:', error);
          }

          return {
            clientId: corporateCreds.clientId?.trim(),
            clientSecret: corporateCreds.clientSecret?.trim(),
            redirectUri: customRedirectUri || defaultRedirectUri,
          };
        }
      }

      // Try individual credentials
      const tenantCreds = await this.getTenantOAuth(tenantId, 'google', 'individual');
      if (tenantCreds) {
        // Check for custom_redirect_uri in database (similar to auth-url route)
        let customRedirectUri: string | undefined;
        try {
          const { createClient } = await import('@/lib/database/server');
          const supabase = await createClient();
          const { data: tenantSettings } = await supabase
            .from('tenant_integration_settings')
            .select('custom_redirect_uri')
            .eq('tenant_id', tenantId)
            .eq('provider', 'google_sheets')
            .eq('use_custom_credentials', true)
            .single();
          
          if (tenantSettings?.custom_redirect_uri) {
            customRedirectUri = tenantSettings.custom_redirect_uri.trim();
          }
        } catch (error) {
          console.warn('Failed to get custom_redirect_uri from database, using default:', error);
        }

        return {
          clientId: tenantCreds.clientId?.trim(),
          clientSecret: tenantCreds.clientSecret?.trim(),
          redirectUri: customRedirectUri || defaultRedirectUri,
        };
      }
    }

    // Fall back to platform credentials from Vercel env vars
    return await this.getGoogleOAuth();
  }

  /**
   * Get tenant-specific Google Service Account credentials
   * Checks Supabase Secrets first, then falls back to Vercel env vars
   */
  async getBestGoogleServiceAccount(tenantId?: string): Promise<GoogleServiceAccountCredentials | null> {
    // Try tenant-specific service account if tenantId is provided
    if (tenantId) {
      try {
        const supabaseManager = getSupabaseCredentialManager();
        const tenantCreds = await supabaseManager.getTenantOAuth(
          tenantId,
          'google',
          'corporate'
        );

        if (tenantCreds?.serviceAccountEmail && tenantCreds?.serviceAccountPrivateKey) {
          // Normalize private key (handle escaped newlines)
          const normalizedPrivateKey = tenantCreds.serviceAccountPrivateKey.replace(/\\n/g, '\n');

          return {
            email: tenantCreds.serviceAccountEmail,
            privateKey: normalizedPrivateKey,
          };
        }
      } catch (error) {
        console.error('Failed to get tenant service account credentials:', error);
        // Fall through to platform credentials
      }
    }

    // Fall back to platform service account from Vercel env vars
    return await this.getGoogleServiceAccount();
  }

  /**
   * Clear credential cache (useful for testing or when credentials are updated)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for a specific credential type
   */
  clearCacheFor(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Get all available credential types and their status
   * Useful for diagnostics and debugging
   */
  async getCredentialStatus(tenantId?: string): Promise<{
    googleOAuth: boolean;
    googleServiceAccount: boolean;
    tenantOAuthIndividual: boolean;
    tenantOAuthCorporate: boolean;
  }> {
    return {
      googleOAuth: await this.hasGoogleOAuth(),
      googleServiceAccount: await this.hasGoogleServiceAccount(),
      tenantOAuthIndividual: tenantId ? await this.hasTenantOAuth(tenantId, 'google', 'individual') : false,
      tenantOAuthCorporate: tenantId ? await this.hasTenantOAuth(tenantId, 'google', 'corporate') : false,
    };
  }
}

/**
 * Convenience function to get credential manager instance
 */
export function getCredentialManager(): VercelCredentialManager {
  return VercelCredentialManager.getInstance();
}

