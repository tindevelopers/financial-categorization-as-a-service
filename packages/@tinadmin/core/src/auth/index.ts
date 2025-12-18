/**
 * AUTH DOMAIN
 * 
 * Central authentication module for the SaaS platform.
 * Provides a provider-agnostic interface for authentication.
 * 
 * PUBLIC API - Only import from this file!
 */

// ============================================================================
// INTERFACES & TYPES
// ============================================================================
export type {
  AuthUser,
  AuthSession,
  AuthProvider,
  AuthConfig,
} from './auth-interface';

// ============================================================================
// PROVIDERS (Client-side)
// ============================================================================
export {
  getCurrentUser,
  getCurrentSession,
} from './supabase-provider';

// ============================================================================
// ACTIONS (Server Actions)
// ============================================================================
export {
  signUp,
  signIn,
  signOut,
} from './actions';

// ============================================================================
// PASSWORD MANAGEMENT
// ============================================================================
export {
  sendPasswordResetEmail,
  updatePassword,
  resetPasswordWithToken,
} from './password';

// ============================================================================
// AUDIT & LOGGING
// ============================================================================
export {
  logPermissionCheck,
  logPermissionCheckWithContext,
  getAuditLogs,
} from './audit-log';

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get the current provider type from environment
 */
export function getAuthProviderType(): 'supabase' | 'workos' | 'auth0' | 'cognito' {
  return (process.env.NEXT_PUBLIC_AUTH_PROVIDER as any) || 'supabase';
}

/**
 * Check if the current auth provider supports a feature
 */
export function supportsFeature(feature: 'oauth' | 'mfa' | 'sso' | 'passwordless'): boolean {
  const provider = getAuthProviderType();
  
  const featureMatrix: Record<string, Record<string, boolean>> = {
    supabase: { oauth: true, mfa: true, sso: false, passwordless: true },
    workos: { oauth: true, mfa: true, sso: true, passwordless: false },
    auth0: { oauth: true, mfa: true, sso: true, passwordless: true },
    cognito: { oauth: true, mfa: true, sso: true, passwordless: false },
  };
  
  return featureMatrix[provider]?.[feature] || false;
}



