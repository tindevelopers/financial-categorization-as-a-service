-- ============================================================================
-- UPDATE TENANT_INTEGRATION_SETTINGS TO USE VAULT REFERENCES
-- ============================================================================
-- This migration adds columns to store vault secret IDs instead of
-- storing encrypted secrets directly in the table.
-- ============================================================================

-- Add columns for vault secret references
ALTER TABLE tenant_integration_settings
ADD COLUMN IF NOT EXISTS client_secret_vault_id UUID,
ADD COLUMN IF NOT EXISTS api_key_vault_id UUID;

-- Add foreign key constraints (optional, vault.secrets may not exist yet)
-- We'll add these as soft references for flexibility
COMMENT ON COLUMN tenant_integration_settings.client_secret_vault_id IS 
  'Reference to vault.secrets for OAuth client secret';
COMMENT ON COLUMN tenant_integration_settings.api_key_vault_id IS 
  'Reference to vault.secrets for API keys (Airtable, etc.)';

-- ============================================================================
-- MIGRATION FUNCTION: Move existing secrets to vault
-- ============================================================================

CREATE OR REPLACE FUNCTION migrate_secrets_to_vault() 
RETURNS void AS $$
DECLARE
  r RECORD;
  v_secret_id UUID;
BEGIN
  -- Migrate client secrets
  FOR r IN 
    SELECT id, tenant_id, provider, custom_client_secret
    FROM tenant_integration_settings 
    WHERE custom_client_secret IS NOT NULL 
      AND client_secret_vault_id IS NULL
  LOOP
    BEGIN
      -- Create secret in vault
      v_secret_id := vault.create_secret(
        'tenant_' || r.tenant_id::TEXT || '_' || r.provider || '_client_secret',
        r.custom_client_secret,
        'OAuth client secret for ' || r.provider
      );
      
      -- Update the settings row with vault reference
      UPDATE tenant_integration_settings
      SET client_secret_vault_id = v_secret_id,
          custom_client_secret = NULL  -- Clear the old encrypted value
      WHERE id = r.id;
      
      RAISE NOTICE 'Migrated client secret for tenant % provider %', r.tenant_id, r.provider;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to migrate client secret for tenant % provider %: %', 
        r.tenant_id, r.provider, SQLERRM;
    END;
  END LOOP;
  
  -- Migrate API keys (Airtable)
  FOR r IN 
    SELECT id, tenant_id, provider, airtable_api_key
    FROM tenant_integration_settings 
    WHERE airtable_api_key IS NOT NULL 
      AND api_key_vault_id IS NULL
  LOOP
    BEGIN
      -- Create secret in vault
      v_secret_id := vault.create_secret(
        'tenant_' || r.tenant_id::TEXT || '_' || r.provider || '_api_key',
        r.airtable_api_key,
        'API key for ' || r.provider
      );
      
      -- Update the settings row with vault reference
      UPDATE tenant_integration_settings
      SET api_key_vault_id = v_secret_id,
          airtable_api_key = NULL  -- Clear the old encrypted value
      WHERE id = r.id;
      
      RAISE NOTICE 'Migrated API key for tenant % provider %', r.tenant_id, r.provider;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to migrate API key for tenant % provider %: %', 
        r.tenant_id, r.provider, SQLERRM;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Note: Run migrate_secrets_to_vault() manually after ensuring vault is working
-- SELECT migrate_secrets_to_vault();

-- ============================================================================
-- HELPER FUNCTIONS FOR API ROUTES
-- ============================================================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS save_integration_secret(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_integration_secret(UUID, TEXT, TEXT);

-- ----------------------------------------------------------------------------
-- Save a secret for a tenant integration
-- Returns the vault secret ID
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION save_integration_secret(
  p_tenant_id UUID,
  p_provider TEXT,
  p_secret_type TEXT,  -- 'client_secret' or 'api_key'
  p_secret_value TEXT
) RETURNS UUID AS $$
DECLARE
  v_secret_id UUID;
  v_name TEXT;
  v_settings_id UUID;
  v_old_vault_id UUID;
BEGIN
  -- Generate a unique name for this secret
  v_name := 'tenant_' || p_tenant_id::TEXT || '_' || p_provider || '_' || p_secret_type;
  
  -- Get the settings record and existing vault ID
  IF p_secret_type = 'client_secret' THEN
    SELECT id, client_secret_vault_id INTO v_settings_id, v_old_vault_id
    FROM tenant_integration_settings
    WHERE tenant_id = p_tenant_id AND provider = p_provider;
  ELSE
    SELECT id, api_key_vault_id INTO v_settings_id, v_old_vault_id
    FROM tenant_integration_settings
    WHERE tenant_id = p_tenant_id AND provider = p_provider;
  END IF;
  
  -- If there's an existing vault secret, update it
  IF v_old_vault_id IS NOT NULL THEN
    PERFORM vault.update_secret(v_old_vault_id, p_secret_value);
    RETURN v_old_vault_id;
  END IF;
  
  -- Create a new vault secret
  v_secret_id := vault.create_secret(
    v_name,
    p_secret_value,
    p_provider || ' ' || p_secret_type || ' for tenant'
  );
  
  -- Update the settings record with the new vault ID
  IF p_secret_type = 'client_secret' THEN
    UPDATE tenant_integration_settings
    SET client_secret_vault_id = v_secret_id,
        custom_client_secret = NULL,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id AND provider = p_provider;
  ELSE
    UPDATE tenant_integration_settings
    SET api_key_vault_id = v_secret_id,
        airtable_api_key = NULL,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id AND provider = p_provider;
  END IF;
  
  RETURN v_secret_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Get a decrypted secret for a tenant integration
-- Returns the plaintext secret value
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_integration_secret(
  p_tenant_id UUID,
  p_provider TEXT,
  p_secret_type TEXT  -- 'client_secret' or 'api_key'
) RETURNS TEXT AS $$
DECLARE
  v_vault_id UUID;
  v_legacy_secret TEXT;
BEGIN
  -- Get the vault ID and legacy secret
  IF p_secret_type = 'client_secret' THEN
    SELECT client_secret_vault_id, custom_client_secret 
    INTO v_vault_id, v_legacy_secret
    FROM tenant_integration_settings
    WHERE tenant_id = p_tenant_id AND provider = p_provider;
  ELSE
    SELECT api_key_vault_id, airtable_api_key 
    INTO v_vault_id, v_legacy_secret
    FROM tenant_integration_settings
    WHERE tenant_id = p_tenant_id AND provider = p_provider;
  END IF;
  
  -- If we have a vault ID, use vault to decrypt
  IF v_vault_id IS NOT NULL THEN
    RETURN vault.get_secret(v_vault_id);
  END IF;
  
  -- If we have a legacy secret, return it (already encrypted with app-level encryption)
  -- The API route will need to decrypt it
  IF v_legacy_secret IS NOT NULL THEN
    RETURN v_legacy_secret;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION save_integration_secret(UUID, TEXT, TEXT, TEXT) IS 
  'Save a secret to vault for a tenant integration. Returns vault secret ID.';
COMMENT ON FUNCTION get_integration_secret(UUID, TEXT, TEXT) IS 
  'Get a decrypted secret for a tenant integration.';
COMMENT ON FUNCTION migrate_secrets_to_vault() IS 
  'One-time migration to move existing secrets to vault. Run manually.';

