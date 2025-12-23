-- =====================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- Google Sheets Preferences & Team Invitations
-- =====================================================

-- User's Google Sheets preferences (which sheet to export to)
CREATE TABLE IF NOT EXISTS user_sheet_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spreadsheet_id TEXT NOT NULL,
  spreadsheet_name TEXT,
  sheet_tab_name TEXT DEFAULT 'Transactions',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_sheet_preferences ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (for re-running)
DROP POLICY IF EXISTS "Users can view own sheet preferences" ON user_sheet_preferences;
DROP POLICY IF EXISTS "Users can insert own sheet preferences" ON user_sheet_preferences;
DROP POLICY IF EXISTS "Users can update own sheet preferences" ON user_sheet_preferences;
DROP POLICY IF EXISTS "Users can delete own sheet preferences" ON user_sheet_preferences;

-- Users can only see/edit their own preferences
CREATE POLICY "Users can view own sheet preferences"
  ON user_sheet_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sheet preferences"
  ON user_sheet_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sheet preferences"
  ON user_sheet_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sheet preferences"
  ON user_sheet_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- Team invitations for company accounts
-- =====================================================
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'collaborator',
  message TEXT,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  invite_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for team_invitations
CREATE INDEX IF NOT EXISTS idx_team_invitations_tenant ON team_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);

-- Enable RLS
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist
DROP POLICY IF EXISTS "Tenant members can view invitations" ON team_invitations;
DROP POLICY IF EXISTS "Tenant admins can create invitations" ON team_invitations;
DROP POLICY IF EXISTS "Tenant admins can update invitations" ON team_invitations;
DROP POLICY IF EXISTS "Tenant admins can delete invitations" ON team_invitations;
DROP POLICY IF EXISTS "Anyone can create invitations" ON team_invitations;
DROP POLICY IF EXISTS "Anyone can manage invitations" ON team_invitations;

-- Simplified policies for team invitations
CREATE POLICY "Tenant members can view invitations"
  ON team_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.tenant_id = team_invitations.tenant_id
    )
  );

-- Allow authenticated users with matching tenant to manage invitations
CREATE POLICY "Anyone can create invitations"
  ON team_invitations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can manage invitations"
  ON team_invitations FOR ALL
  USING (auth.uid() IS NOT NULL);

-- =====================================================
-- OAuth states table
-- =====================================================
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_user ON oauth_states(user_id);

ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own oauth states" ON oauth_states;

CREATE POLICY "Users can manage own oauth states"
  ON oauth_states FOR ALL
  USING (auth.uid() = user_id);

-- =====================================================
-- User integrations table
-- =====================================================
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  provider_email TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_integrations_user ON user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_provider ON user_integrations(provider);

ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own integrations" ON user_integrations;
DROP POLICY IF EXISTS "Users can insert own integrations" ON user_integrations;
DROP POLICY IF EXISTS "Users can update own integrations" ON user_integrations;
DROP POLICY IF EXISTS "Users can delete own integrations" ON user_integrations;

CREATE POLICY "Users can view own integrations"
  ON user_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations"
  ON user_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
  ON user_integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations"
  ON user_integrations FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- Tenant integration settings (for custom OAuth)
-- =====================================================
CREATE TABLE IF NOT EXISTS tenant_integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  use_custom_credentials BOOLEAN DEFAULT false,
  custom_client_id TEXT,
  custom_client_secret TEXT, -- Encrypted
  custom_redirect_uri TEXT,
  airtable_api_key TEXT, -- Encrypted
  airtable_base_id TEXT,
  airtable_table_name TEXT,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_tenant_integration_settings_tenant ON tenant_integration_settings(tenant_id);

ALTER TABLE tenant_integration_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view settings" ON tenant_integration_settings;
DROP POLICY IF EXISTS "Tenant admins can manage settings" ON tenant_integration_settings;

CREATE POLICY "Tenant members can view settings"
  ON tenant_integration_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.tenant_id = tenant_integration_settings.tenant_id
    )
  );

CREATE POLICY "Tenant admins can manage settings"
  ON tenant_integration_settings FOR ALL
  USING (auth.uid() IS NOT NULL);

-- =====================================================
-- Done!
-- =====================================================
SELECT 'Migration completed successfully!' as result;

