-- Migration: Create Bank Accounts Table
-- Description: Dedicated table for bank accounts, replacing JSONB array in company_profiles
-- Created: 2025-12-26

-- ============================================================================
-- BANK_ACCOUNTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE SET NULL,
  
  -- Account Details
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'credit_card', 'business')),
  bank_name TEXT NOT NULL,
  sort_code TEXT, -- UK sort code
  account_number TEXT, -- Last 4 digits for display
  iban TEXT, -- Full IBAN if available
  
  -- Spreadsheet Configuration
  spreadsheet_tab_name TEXT, -- Custom tab name in spreadsheet (defaults to account_name)
  default_spreadsheet_id TEXT, -- Google Sheets spreadsheet ID
  
  -- Account Status
  currency TEXT DEFAULT 'GBP',
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_tenant_id ON bank_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_company_profile_id ON bank_accounts(company_profile_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_account_type ON bank_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_is_active ON bank_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_default_spreadsheet_id ON bank_accounts(default_spreadsheet_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- Users can view their own bank accounts
CREATE POLICY "Users can view their own bank accounts"
  ON bank_accounts FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view bank accounts for their tenant
CREATE POLICY "Users can view tenant bank accounts"
  ON bank_accounts FOR SELECT
  USING (
    tenant_id IN (
      SELECT u.tenant_id FROM users u WHERE u.id = auth.uid()
    )
  );

-- Platform admins can view all bank accounts
CREATE POLICY "Platform admins can view all bank accounts"
  ON bank_accounts FOR SELECT
  USING (is_platform_admin());

-- Users can create their own bank accounts
CREATE POLICY "Users can create their own bank accounts"
  ON bank_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own bank accounts
CREATE POLICY "Users can update their own bank accounts"
  ON bank_accounts FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own bank accounts
CREATE POLICY "Users can delete their own bank accounts"
  ON bank_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- Platform admins can manage all bank accounts
CREATE POLICY "Platform admins can manage all bank accounts"
  ON bank_accounts FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE bank_accounts IS 'Dedicated table for bank accounts, replacing JSONB array in company_profiles';
COMMENT ON COLUMN bank_accounts.account_type IS 'Type of account: checking, savings, credit_card, or business';
COMMENT ON COLUMN bank_accounts.spreadsheet_tab_name IS 'Custom tab name in spreadsheet (defaults to account_name if not set)';
COMMENT ON COLUMN bank_accounts.default_spreadsheet_id IS 'Default Google Sheets spreadsheet ID for this bank account';

