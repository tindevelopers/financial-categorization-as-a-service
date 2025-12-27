-- ============================================================================
-- TENANT OAUTH CREDENTIALS TABLE
-- Stores references to Supabase Secrets for tenant-specific OAuth credentials
-- ============================================================================
-- This table stores metadata about tenant OAuth credentials that are stored
-- in Supabase Secrets Management. The actual secret values are stored securely
-- in Supabase Secrets and accessed via Edge Functions or RPC functions.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_oauth_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'dropbox', 'google_sheets', 'google_drive')),
  credential_type TEXT NOT NULL CHECK (credential_type IN ('individual', 'corporate')),
  
  -- References to Supabase Secrets (secret names, not values)
  -- Format: TENANT_{tenantId}_{PROVIDER}_{TYPE}_{FIELD}
  -- Example: TENANT_abc123_GOOGLE_INDIVIDUAL_CLIENT_ID
  client_id_secret_name TEXT NOT NULL,
  client_secret_secret_name TEXT NOT NULL,
  
  -- For corporate Google Service Accounts
  service_account_email TEXT,
  service_account_secret_name TEXT,  -- Reference to private key in Supabase Secrets
  
  -- Configuration
  redirect_uri TEXT,  -- Custom redirect URI if different from default
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one credential set per provider/type per tenant
  UNIQUE(tenant_id, provider, credential_type)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tenant_oauth_credentials_tenant 
  ON tenant_oauth_credentials(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_oauth_credentials_provider 
  ON tenant_oauth_credentials(provider);

CREATE INDEX IF NOT EXISTS idx_tenant_oauth_credentials_type 
  ON tenant_oauth_credentials(credential_type);

CREATE INDEX IF NOT EXISTS idx_tenant_oauth_credentials_active 
  ON tenant_oauth_credentials(is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_tenant_oauth_credentials_secret_names 
  ON tenant_oauth_credentials(client_id_secret_name, client_secret_secret_name);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE tenant_oauth_credentials ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view own tenant oauth credentials" ON tenant_oauth_credentials;
DROP POLICY IF EXISTS "Users can insert own tenant oauth credentials" ON tenant_oauth_credentials;
DROP POLICY IF EXISTS "Users can update own tenant oauth credentials" ON tenant_oauth_credentials;
DROP POLICY IF EXISTS "Users can delete own tenant oauth credentials" ON tenant_oauth_credentials;
DROP POLICY IF EXISTS "Platform admins can manage all oauth credentials" ON tenant_oauth_credentials;
DROP TRIGGER IF EXISTS update_tenant_oauth_credentials_updated_at ON tenant_oauth_credentials;

-- Users can only view their own tenant's OAuth credentials
CREATE POLICY "Users can view own tenant oauth credentials" 
  ON tenant_oauth_credentials
  FOR SELECT 
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Users can only insert credentials for their own tenant
CREATE POLICY "Users can insert own tenant oauth credentials" 
  ON tenant_oauth_credentials
  FOR INSERT 
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Users can only update their own tenant's credentials
CREATE POLICY "Users can update own tenant oauth credentials" 
  ON tenant_oauth_credentials
  FOR UPDATE 
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Users can only delete their own tenant's credentials
CREATE POLICY "Users can delete own tenant oauth credentials" 
  ON tenant_oauth_credentials
  FOR DELETE 
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Platform admins can manage all OAuth credentials
CREATE POLICY "Platform admins can manage all oauth credentials" 
  ON tenant_oauth_credentials
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() 
      AND r.name = 'Platform Admin'
    )
  );

-- ============================================================================
-- TRIGGER FOR updated_at
-- ============================================================================

CREATE TRIGGER update_tenant_oauth_credentials_updated_at
  BEFORE UPDATE ON tenant_oauth_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE tenant_oauth_credentials IS 
  'Stores metadata about tenant OAuth credentials stored in Supabase Secrets Management';

COMMENT ON COLUMN tenant_oauth_credentials.provider IS 
  'OAuth provider: google, dropbox, google_sheets, google_drive';

COMMENT ON COLUMN tenant_oauth_credentials.credential_type IS 
  'Type of credential: individual (user-level) or corporate (company-level)';

COMMENT ON COLUMN tenant_oauth_credentials.client_id_secret_name IS 
  'Name of the Supabase Secret storing the OAuth client ID (e.g., TENANT_abc123_GOOGLE_INDIVIDUAL_CLIENT_ID)';

COMMENT ON COLUMN tenant_oauth_credentials.client_secret_secret_name IS 
  'Name of the Supabase Secret storing the OAuth client secret';

COMMENT ON COLUMN tenant_oauth_credentials.service_account_secret_name IS 
  'Name of the Supabase Secret storing the Google Service Account private key (corporate only)';

