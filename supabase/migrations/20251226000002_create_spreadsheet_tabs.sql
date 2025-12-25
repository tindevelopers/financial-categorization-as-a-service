-- Migration: Create Spreadsheet Tabs Configuration Table
-- Description: Manage spreadsheet tabs and their associated bank accounts
-- Created: 2025-12-26

-- ============================================================================
-- SPREADSHEET_TABS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS spreadsheet_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Spreadsheet Configuration
  spreadsheet_id TEXT NOT NULL, -- Google Sheets spreadsheet ID
  tab_name TEXT NOT NULL, -- Tab name in spreadsheet
  
  -- Bank Account Association
  bank_account_ids UUID[] DEFAULT '{}', -- Array of bank account IDs included in this tab
  
  -- Tab Properties
  is_main_tab BOOLEAN DEFAULT FALSE, -- Is this the main aggregated tab?
  tab_order INTEGER DEFAULT 0, -- Display order
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, spreadsheet_id, tab_name)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_spreadsheet_tabs_user_id ON spreadsheet_tabs(user_id);
CREATE INDEX IF NOT EXISTS idx_spreadsheet_tabs_tenant_id ON spreadsheet_tabs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_spreadsheet_tabs_spreadsheet_id ON spreadsheet_tabs(spreadsheet_id);
CREATE INDEX IF NOT EXISTS idx_spreadsheet_tabs_is_main_tab ON spreadsheet_tabs(is_main_tab);
CREATE INDEX IF NOT EXISTS idx_spreadsheet_tabs_bank_account_ids ON spreadsheet_tabs USING gin(bank_account_ids);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE spreadsheet_tabs ENABLE ROW LEVEL SECURITY;

-- Users can view their own spreadsheet tabs
CREATE POLICY "Users can view their own spreadsheet tabs"
  ON spreadsheet_tabs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view spreadsheet tabs for their tenant
CREATE POLICY "Users can view tenant spreadsheet tabs"
  ON spreadsheet_tabs FOR SELECT
  USING (
    tenant_id IN (
      SELECT u.tenant_id FROM users u WHERE u.id = auth.uid()
    )
  );

-- Platform admins can view all spreadsheet tabs
CREATE POLICY "Platform admins can view all spreadsheet tabs"
  ON spreadsheet_tabs FOR SELECT
  USING (is_platform_admin());

-- Users can create their own spreadsheet tabs
CREATE POLICY "Users can create their own spreadsheet tabs"
  ON spreadsheet_tabs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own spreadsheet tabs
CREATE POLICY "Users can update their own spreadsheet tabs"
  ON spreadsheet_tabs FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own spreadsheet tabs
CREATE POLICY "Users can delete their own spreadsheet tabs"
  ON spreadsheet_tabs FOR DELETE
  USING (auth.uid() = user_id);

-- Platform admins can manage all spreadsheet tabs
CREATE POLICY "Platform admins can manage all spreadsheet tabs"
  ON spreadsheet_tabs FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_spreadsheet_tabs_updated_at
  BEFORE UPDATE ON spreadsheet_tabs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to ensure only one main tab per spreadsheet
CREATE OR REPLACE FUNCTION ensure_single_main_tab()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_main_tab = TRUE THEN
    -- Unset other main tabs for the same spreadsheet
    UPDATE spreadsheet_tabs
    SET is_main_tab = FALSE
    WHERE spreadsheet_id = NEW.spreadsheet_id
      AND user_id = NEW.user_id
      AND id != NEW.id
      AND is_main_tab = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_main_tab_trigger
  BEFORE INSERT OR UPDATE ON spreadsheet_tabs
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_main_tab();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE spreadsheet_tabs IS 'Configuration for spreadsheet tabs and their associated bank accounts';
COMMENT ON COLUMN spreadsheet_tabs.bank_account_ids IS 'Array of bank account IDs included in this tab';
COMMENT ON COLUMN spreadsheet_tabs.is_main_tab IS 'If true, this is the main aggregated tab for the spreadsheet';
COMMENT ON COLUMN spreadsheet_tabs.tab_order IS 'Display order for tabs (lower numbers appear first)';

