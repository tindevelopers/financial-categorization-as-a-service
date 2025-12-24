-- Migration: Company/Individual Profiles
-- Phase: Week 1 - Foundation
-- Description: Multi-company support with VAT settings and tax configuration
-- Created: 2025-12-21

-- ============================================================================
-- COMPANY_PROFILES TABLE (User's Business Profiles)
-- Note: Using 'company_profiles' to avoid conflict with CRM 'companies' table
-- ============================================================================

CREATE TABLE IF NOT EXISTS company_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Company Details
  company_name TEXT NOT NULL,
  company_type TEXT NOT NULL CHECK (company_type IN ('sole_trader', 'limited_company', 'partnership', 'individual')),
  company_number TEXT, -- For limited companies (Companies House number)
  
  -- VAT Registration
  vat_registered BOOLEAN DEFAULT FALSE,
  vat_number TEXT,
  vat_scheme TEXT CHECK (vat_scheme IN ('standard', 'flat_rate', 'cash_accounting', NULL)),
  flat_rate_percentage DECIMAL(4,2), -- e.g., 16.50 for 16.5%
  
  -- Accounting Settings
  financial_year_end DATE, -- e.g., '2025-03-31'
  accounting_basis TEXT DEFAULT 'cash' CHECK (accounting_basis IN ('cash', 'accrual')),
  default_currency TEXT DEFAULT 'GBP',
  
  -- Contact & Address
  address JSONB DEFAULT '{}'::jsonb, -- { street, city, postcode, country }
  contact_details JSONB DEFAULT '{}'::jsonb, -- { email, phone, website }
  
  -- Bank Accounts (for reconciliation context)
  bank_accounts JSONB DEFAULT '[]'::jsonb, -- [{ name, sort_code, account_number, bank }]
  
  -- Setup Status
  setup_completed BOOLEAN DEFAULT FALSE,
  setup_step INTEGER DEFAULT 1, -- Current step in setup wizard
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_company_profiles_user_id ON company_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_company_profiles_tenant_id ON company_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_profiles_setup_completed ON company_profiles(setup_completed);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own company profiles" ON company_profiles;
DROP POLICY IF EXISTS "Users can create their own company profiles" ON company_profiles;
DROP POLICY IF EXISTS "Users can update their own company profiles" ON company_profiles;
DROP POLICY IF EXISTS "Users can delete their own company profiles" ON company_profiles;
DROP TRIGGER IF EXISTS company_profiles_updated_at ON company_profiles;

-- Users can view their own company profiles
CREATE POLICY "Users can view their own company profiles"
  ON company_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own company profiles
CREATE POLICY "Users can create their own company profiles"
  ON company_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own company profiles
CREATE POLICY "Users can update their own company profiles"
  ON company_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own company profiles
CREATE POLICY "Users can delete their own company profiles"
  ON company_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_company_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER company_profiles_updated_at
  BEFORE UPDATE ON company_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_company_profiles_updated_at();

-- Function to get user's active company profile
CREATE OR REPLACE FUNCTION get_active_company_profile(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Get the first company profile for the user
  SELECT id INTO v_company_id
  FROM company_profiles
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN v_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE company_profiles IS 'Multi-company support: stores company/individual profiles with VAT and tax settings (renamed from companies to avoid CRM conflict)';
COMMENT ON COLUMN company_profiles.company_type IS 'Type: sole_trader, limited_company, partnership, or individual';
COMMENT ON COLUMN company_profiles.vat_scheme IS 'VAT scheme: standard, flat_rate, or cash_accounting';
COMMENT ON COLUMN company_profiles.accounting_basis IS 'Accounting method: cash or accrual';
COMMENT ON COLUMN company_profiles.setup_completed IS 'Whether the company setup wizard has been completed';
COMMENT ON COLUMN company_profiles.bank_accounts IS 'Array of bank account details for reconciliation context';

