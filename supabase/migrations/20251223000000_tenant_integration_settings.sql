-- Migration: Tenant Integration Settings
-- Description: Store tenant-level integration configuration for Google Sheets, Airtable, etc.
-- Created: 2025-12-23

-- ============================================================================
-- TENANT_INTEGRATION_SETTINGS TABLE
-- Stores integration credentials and configuration per tenant
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,  -- 'google_sheets', 'airtable', etc.
  
  -- For custom OAuth credentials (companies only)
  custom_client_id TEXT,
  custom_client_secret TEXT,  -- encrypted
  custom_redirect_uri TEXT,
  
  -- Airtable specific fields
  airtable_api_key TEXT,  -- encrypted
  airtable_base_id TEXT,
  airtable_table_name TEXT,
  
  -- Configuration flags
  use_custom_credentials BOOLEAN DEFAULT FALSE,
  is_enabled BOOLEAN DEFAULT TRUE,
  
  -- Additional metadata
  settings JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one setting per provider per tenant
  UNIQUE(tenant_id, provider)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tenant_integration_settings_tenant 
  ON tenant_integration_settings(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_integration_settings_provider 
  ON tenant_integration_settings(provider);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE tenant_integration_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view own tenant integration settings" ON tenant_integration_settings;
DROP POLICY IF EXISTS "Users can insert own tenant integration settings" ON tenant_integration_settings;
DROP POLICY IF EXISTS "Users can update own tenant integration settings" ON tenant_integration_settings;
DROP POLICY IF EXISTS "Users can delete own tenant integration settings" ON tenant_integration_settings;
DROP POLICY IF EXISTS "Platform admins can manage all integration settings" ON tenant_integration_settings;
DROP TRIGGER IF EXISTS update_tenant_integration_settings_updated_at ON tenant_integration_settings;

-- Users can only view their own tenant's integration settings
CREATE POLICY "Users can view own tenant integration settings" 
  ON tenant_integration_settings
  FOR SELECT 
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Users can only insert settings for their own tenant
CREATE POLICY "Users can insert own tenant integration settings" 
  ON tenant_integration_settings
  FOR INSERT 
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Users can only update their own tenant's settings
CREATE POLICY "Users can update own tenant integration settings" 
  ON tenant_integration_settings
  FOR UPDATE 
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Users can only delete their own tenant's settings
CREATE POLICY "Users can delete own tenant integration settings" 
  ON tenant_integration_settings
  FOR DELETE 
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Platform admins can manage all integration settings
CREATE POLICY "Platform admins can manage all integration settings" 
  ON tenant_integration_settings
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

CREATE TRIGGER update_tenant_integration_settings_updated_at
  BEFORE UPDATE ON tenant_integration_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE tenant_integration_settings IS 'Stores tenant-level integration configuration for external services';
COMMENT ON COLUMN tenant_integration_settings.provider IS 'Integration provider: google_sheets, airtable, etc.';
COMMENT ON COLUMN tenant_integration_settings.custom_client_secret IS 'Encrypted OAuth client secret for custom credentials';
COMMENT ON COLUMN tenant_integration_settings.airtable_api_key IS 'Encrypted Airtable API key';
COMMENT ON COLUMN tenant_integration_settings.use_custom_credentials IS 'Whether to use custom credentials instead of platform OAuth';

