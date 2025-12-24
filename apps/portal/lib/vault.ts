/**
 * Vault Helper Library
 * 
 * Provides TypeScript interface for interacting with Supabase Vault
 * for secure secret storage and retrieval.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type SecretType = 'client_secret' | 'api_key';

/**
 * Save a secret to the vault for a tenant integration
 * 
 * @param supabase - Supabase client (must have service role for RPC calls)
 * @param tenantId - Tenant UUID
 * @param provider - Integration provider (e.g., 'google_sheets', 'airtable')
 * @param secretType - Type of secret ('client_secret' or 'api_key')
 * @param secretValue - The plaintext secret to encrypt and store
 * @returns The vault secret ID, or null if failed
 */
export async function saveSecret(
  supabase: SupabaseClient,
  tenantId: string,
  provider: string,
  secretType: SecretType,
  secretValue: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('save_integration_secret', {
      p_tenant_id: tenantId,
      p_provider: provider,
      p_secret_type: secretType,
      p_secret_value: secretValue,
    });

    if (error) {
      console.error('Error saving secret to vault:', error);
      return null;
    }

    return data as string;
  } catch (error) {
    console.error('Failed to save secret to vault:', error);
    return null;
  }
}

/**
 * Retrieve a decrypted secret from the vault
 * 
 * @param supabase - Supabase client
 * @param tenantId - Tenant UUID
 * @param provider - Integration provider
 * @param secretType - Type of secret to retrieve
 * @returns The decrypted secret value, or null if not found
 */
export async function getSecret(
  supabase: SupabaseClient,
  tenantId: string,
  provider: string,
  secretType: SecretType
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('get_integration_secret', {
      p_tenant_id: tenantId,
      p_provider: provider,
      p_secret_type: secretType,
    });

    if (error) {
      console.error('Error retrieving secret from vault:', error);
      return null;
    }

    return data as string | null;
  } catch (error) {
    console.error('Failed to retrieve secret from vault:', error);
    return null;
  }
}

/**
 * Check if vault functions are available
 * 
 * This can be used to determine whether to use vault or fall back
 * to application-level encryption.
 * 
 * @param supabase - Supabase client
 * @returns True if vault functions are available
 */
export async function isVaultAvailable(supabase: SupabaseClient): Promise<boolean> {
  try {
    // Try to call a simple vault function
    const { error } = await supabase.rpc('get_integration_secret', {
      p_tenant_id: '00000000-0000-0000-0000-000000000000',
      p_provider: 'test',
      p_secret_type: 'client_secret',
    });

    // If the function doesn't exist, we'll get a specific error
    if (error && error.message?.includes('function') && error.message?.includes('does not exist')) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Mask a secret value for display (e.g., in API responses)
 * 
 * @param value - The value to mask
 * @param showChars - Number of characters to show at start and end
 * @returns Masked string
 */
export function maskSecretValue(value: string | null | undefined, showChars: number = 4): string {
  if (!value || value.length <= showChars * 2) {
    return '••••••••';
  }
  
  const start = value.substring(0, showChars);
  const end = value.substring(value.length - showChars);
  
  return `${start}${'•'.repeat(8)}${end}`;
}

