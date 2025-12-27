-- ============================================================================
-- COMBINED MIGRATION: Tenant OAuth Credentials
-- Apply this file via Supabase Dashboard > SQL Editor
-- ============================================================================
-- This combines both migration files for easy application
-- ============================================================================

-- Migration 1: Create tenant_oauth_credentials table
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

-- Indexes
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

-- RLS Policies
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

-- Trigger for updated_at
CREATE TRIGGER update_tenant_oauth_credentials_updated_at
  BEFORE UPDATE ON tenant_oauth_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
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

-- ============================================================================
-- Migration 2: Create RPC Functions
-- ============================================================================

-- Get tenant OAuth credential metadata
CREATE OR REPLACE FUNCTION get_tenant_oauth_credential_metadata(
  p_tenant_id UUID,
  p_provider TEXT,
  p_credential_type TEXT DEFAULT 'individual'
) RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  provider TEXT,
  credential_type TEXT,
  client_id_secret_name TEXT,
  client_secret_secret_name TEXT,
  service_account_email TEXT,
  service_account_secret_name TEXT,
  redirect_uri TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    toc.id,
    toc.tenant_id,
    toc.provider,
    toc.credential_type,
    toc.client_id_secret_name,
    toc.client_secret_secret_name,
    toc.service_account_email,
    toc.service_account_secret_name,
    toc.redirect_uri,
    toc.is_active,
    toc.created_at,
    toc.updated_at
  FROM tenant_oauth_credentials toc
  WHERE toc.tenant_id = p_tenant_id
    AND toc.provider = p_provider
    AND toc.credential_type = p_credential_type
    AND toc.is_active = TRUE
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Save tenant OAuth credentials
CREATE OR REPLACE FUNCTION save_tenant_oauth_credentials(
  p_tenant_id UUID,
  p_provider TEXT,
  p_credential_type TEXT,
  p_client_id_secret_name TEXT,
  p_client_secret_secret_name TEXT,
  p_service_account_email TEXT DEFAULT NULL,
  p_service_account_secret_name TEXT DEFAULT NULL,
  p_redirect_uri TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_secret_name_prefix TEXT;
BEGIN
  -- Generate secret name prefix for validation
  v_secret_name_prefix := 'TENANT_' || p_tenant_id::TEXT || '_' || UPPER(p_provider) || '_' || UPPER(p_credential_type);
  
  -- Validate secret names match expected format
  IF p_client_id_secret_name NOT LIKE v_secret_name_prefix || '_CLIENT_ID' THEN
    RAISE EXCEPTION 'Invalid client_id_secret_name format. Expected: %_CLIENT_ID', v_secret_name_prefix;
  END IF;
  
  IF p_client_secret_secret_name NOT LIKE v_secret_name_prefix || '_CLIENT_SECRET' THEN
    RAISE EXCEPTION 'Invalid client_secret_secret_name format. Expected: %_CLIENT_SECRET', v_secret_name_prefix;
  END IF;
  
  -- Upsert the credential metadata
  INSERT INTO tenant_oauth_credentials (
    tenant_id,
    provider,
    credential_type,
    client_id_secret_name,
    client_secret_secret_name,
    service_account_email,
    service_account_secret_name,
    redirect_uri,
    is_active,
    updated_at
  )
  VALUES (
    p_tenant_id,
    p_provider,
    p_credential_type,
    p_client_id_secret_name,
    p_client_secret_secret_name,
    p_service_account_email,
    p_service_account_secret_name,
    p_redirect_uri,
    TRUE,
    NOW()
  )
  ON CONFLICT (tenant_id, provider, credential_type)
  DO UPDATE SET
    client_id_secret_name = EXCLUDED.client_id_secret_name,
    client_secret_secret_name = EXCLUDED.client_secret_secret_name,
    service_account_email = EXCLUDED.service_account_email,
    service_account_secret_name = EXCLUDED.service_account_secret_name,
    redirect_uri = EXCLUDED.redirect_uri,
    is_active = TRUE,
    updated_at = NOW()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete tenant OAuth credentials
CREATE OR REPLACE FUNCTION delete_tenant_oauth_credentials(
  p_tenant_id UUID,
  p_provider TEXT,
  p_credential_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  UPDATE tenant_oauth_credentials
  SET is_active = FALSE,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id
    AND provider = p_provider
    AND credential_type = p_credential_type;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get best available OAuth credentials (with fallback)
CREATE OR REPLACE FUNCTION get_best_tenant_oauth_credentials(
  p_tenant_id UUID,
  p_provider TEXT,
  p_credential_type TEXT DEFAULT 'individual'
) RETURNS TABLE (
  has_tenant_credentials BOOLEAN,
  client_id_secret_name TEXT,
  client_secret_secret_name TEXT,
  service_account_email TEXT,
  service_account_secret_name TEXT,
  redirect_uri TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as has_tenant_credentials,
    toc.client_id_secret_name,
    toc.client_secret_secret_name,
    toc.service_account_email,
    toc.service_account_secret_name,
    toc.redirect_uri
  FROM tenant_oauth_credentials toc
  WHERE toc.tenant_id = p_tenant_id
    AND toc.provider = p_provider
    AND toc.credential_type = p_credential_type
    AND toc.is_active = TRUE
  LIMIT 1;
  
  -- If no tenant credentials found, return NULL to indicate fallback needed
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      FALSE as has_tenant_credentials,
      NULL::TEXT as client_id_secret_name,
      NULL::TEXT as client_secret_secret_name,
      NULL::TEXT as service_account_email,
      NULL::TEXT as service_account_secret_name,
      NULL::TEXT as redirect_uri;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- List all tenant OAuth credentials
CREATE OR REPLACE FUNCTION list_tenant_oauth_credentials(
  p_tenant_id UUID
) RETURNS TABLE (
  id UUID,
  provider TEXT,
  credential_type TEXT,
  client_id_secret_name TEXT,
  client_secret_secret_name TEXT,
  service_account_email TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    toc.id,
    toc.provider,
    toc.credential_type,
    toc.client_id_secret_name,
    toc.client_secret_secret_name,
    toc.service_account_email,
    toc.is_active,
    toc.created_at,
    toc.updated_at
  FROM tenant_oauth_credentials toc
  WHERE toc.tenant_id = p_tenant_id
    AND toc.is_active = TRUE
  ORDER BY toc.provider, toc.credential_type, toc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON FUNCTION get_tenant_oauth_credential_metadata(UUID, TEXT, TEXT) IS 
  'Get metadata for tenant OAuth credentials. Returns secret names that can be used to retrieve actual secrets via Edge Functions.';

COMMENT ON FUNCTION save_tenant_oauth_credentials(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS 
  'Save tenant OAuth credential metadata. Secrets must be stored in Supabase Secrets before calling this function.';

COMMENT ON FUNCTION delete_tenant_oauth_credentials(UUID, TEXT, TEXT) IS 
  'Soft delete tenant OAuth credentials by setting is_active = FALSE.';

COMMENT ON FUNCTION get_best_tenant_oauth_credentials(UUID, TEXT, TEXT) IS 
  'Get best available OAuth credentials for a tenant. Returns tenant-specific if available, otherwise NULL to indicate fallback to platform defaults.';

COMMENT ON FUNCTION list_tenant_oauth_credentials(UUID) IS 
  'List all active OAuth credentials for a tenant.';

-- ============================================================================
-- Migration Complete
-- ============================================================================

