-- Migration: Account to Google Sheet mappings (plus suspense)
-- Created: 2025-12-31

-- Maps a financial account (currently derived from company_profiles.bank_accounts JSON) to a spreadsheet
CREATE TABLE IF NOT EXISTS account_sheet_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Deterministic identifier for the account (e.g. bank:{bank}:{sort_code}:{account_number})
  account_key TEXT NOT NULL,

  -- What this mapping is for
  purpose TEXT NOT NULL DEFAULT 'account' CHECK (purpose IN ('account', 'suspense')),

  -- Target sheet
  spreadsheet_id TEXT NOT NULL,
  spreadsheet_name TEXT,
  sheet_tab_name TEXT DEFAULT 'Transactions',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One mapping per account_key per user
  UNIQUE(user_id, account_key, purpose)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_account_sheet_mappings_user_id
  ON account_sheet_mappings(user_id);

CREATE INDEX IF NOT EXISTS idx_account_sheet_mappings_tenant_id
  ON account_sheet_mappings(tenant_id);

CREATE INDEX IF NOT EXISTS idx_account_sheet_mappings_account_key
  ON account_sheet_mappings(account_key);

CREATE INDEX IF NOT EXISTS idx_account_sheet_mappings_purpose
  ON account_sheet_mappings(purpose);

-- Enable RLS
ALTER TABLE account_sheet_mappings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can view own account sheet mappings" ON account_sheet_mappings;
DROP POLICY IF EXISTS "Users can insert own account sheet mappings" ON account_sheet_mappings;
DROP POLICY IF EXISTS "Users can update own account sheet mappings" ON account_sheet_mappings;
DROP POLICY IF EXISTS "Users can delete own account sheet mappings" ON account_sheet_mappings;

-- Users can only manage their own mappings
CREATE POLICY "Users can view own account sheet mappings"
  ON account_sheet_mappings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own account sheet mappings"
  ON account_sheet_mappings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own account sheet mappings"
  ON account_sheet_mappings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own account sheet mappings"
  ON account_sheet_mappings FOR DELETE
  USING (auth.uid() = user_id);


