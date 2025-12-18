/**
 * AUTH INTERFACE
 * 
 * Defines the contract for authentication providers.
 * This allows swapping between Supabase, WorkOS, Auth0, Cognito, etc.
 */

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  metadata?: Record<string, any>;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface AuthProvider {
  /**
   * Sign in with email and password
   */
  signIn(email: string, password: string): Promise<AuthSession>;

  /**
   * Sign up a new user
   */
  signUp(email: string, password: string, metadata?: Record<string, any>): Promise<AuthUser>;

  /**
   * Sign out the current user
   */
  signOut(): Promise<void>;

  /**
   * Get the current session
   */
  getSession(): Promise<AuthSession | null>;

  /**
   * Get the current user
   */
  getUser(): Promise<AuthUser | null>;

  /**
   * Send password reset email
   */
  resetPassword(email: string): Promise<void>;

  /**
   * Update password
   */
  updatePassword(newPassword: string): Promise<void>;

  /**
   * Refresh the session
   */
  refreshSession(): Promise<AuthSession>;

  /**
   * OAuth sign in (Google, GitHub, etc.)
   */
  signInWithOAuth(provider: string, redirectTo?: string): Promise<void>;

  /**
   * Verify email with OTP
   */
  verifyOTP(email: string, otp: string): Promise<AuthSession>;
}

/**
 * Auth configuration for different providers
 */
export interface AuthConfig {
  provider: 'supabase' | 'workos' | 'auth0' | 'cognito' | 'firebase';
  supabase?: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };
  workos?: {
    apiKey: string;
    clientId: string;
  };
  auth0?: {
    domain: string;
    clientId: string;
    clientSecret: string;
  };
  cognito?: {
    userPoolId: string;
    clientId: string;
    region: string;
  };
  firebase?: {
    apiKey: string;
    authDomain: string;
    projectId: string;
  };
}




