-- Migration: Company/Individual Profiles (FIXED - No Naming Conflict)
-- Phase: Week 1 - Foundation
-- Table Name: company_profiles (not "companies" to avoid CRM conflict)
-- Created: 2025-12-21

-- ============================================================================
-- COMPANY_PROFILES TABLE (User's Business Profiles)
-- ============================================================================

CREATE TABLE IF NOT EXISTS company_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Company Details
  company_name TEXT NOT NULL,
  company_type TEXT NOT NULL CHECK (company_type IN ('sole_trader', 'limited_company', 'partnership', 'individual')),
  company_number TEXT,
  
  -- VAT Registration
  vat_registered BOOLEAN DEFAULT FALSE,
  vat_number TEXT,
  vat_scheme TEXT CHECK (vat_scheme IN ('standard', 'flat_rate', 'cash_accounting', NULL)),
  flat_rate_percentage DECIMAL(4,2),
  
  -- Accounting Settings
  financial_year_end DATE,
  accounting_basis TEXT DEFAULT 'cash' CHECK (accounting_basis IN ('cash', 'accrual')),
  default_currency TEXT DEFAULT 'GBP',
  
  -- Contact & Address
  address JSONB DEFAULT '{}'::jsonb,
  contact_details JSONB DEFAULT '{}'::jsonb,
  
  -- Bank Accounts (for reconciliation context)
  bank_accounts JSONB DEFAULT '[]'::jsonb,
  
  -- Setup Status
  setup_completed BOOLEAN DEFAULT FALSE,
  setup_step INTEGER DEFAULT 1,
  
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

-- Function to get user's active company profile
CREATE OR REPLACE FUNCTION get_active_company_profile(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT id INTO v_company_id
  FROM company_profiles
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN v_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER company_profiles_updated_at
  BEFORE UPDATE ON company_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_company_profiles_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;

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
-- VERIFICATION QUERY
-- ============================================================================

-- Run this to verify the table was created successfully
SELECT 
  'company_profiles' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'company_profiles';

-- Check RLS is enabled
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'company_profiles';

