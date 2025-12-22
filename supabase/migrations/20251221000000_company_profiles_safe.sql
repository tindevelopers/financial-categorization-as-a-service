-- Migration: Company/Individual Profiles (Safe Version)
-- Phase: Week 1 - Foundation
-- Description: Multi-company support with VAT settings and tax configuration
-- Created: 2025-12-21

-- ============================================================================
-- DROP EXISTING POLICIES AND FUNCTIONS (if any conflicts exist)
-- ============================================================================

-- Drop policies if they exist
DROP POLICY IF EXISTS "Users can view their own companies" ON companies;
DROP POLICY IF EXISTS "Users can create their own companies" ON companies;
DROP POLICY IF EXISTS "Users can update their own companies" ON companies;
DROP POLICY IF EXISTS "Users can delete their own companies" ON companies;

-- Drop triggers if they exist
DROP TRIGGER IF EXISTS companies_updated_at ON companies;

-- Drop functions if they exist
DROP FUNCTION IF EXISTS update_companies_updated_at() CASCADE;
DROP FUNCTION IF EXISTS get_active_company(UUID) CASCADE;

-- Drop table if exists (CAUTION: This will delete existing data)
-- Comment this out if you want to preserve data
-- DROP TABLE IF EXISTS companies CASCADE;

-- ============================================================================
-- COMPANIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS companies (
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

CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_companies_tenant_id ON companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_companies_setup_completed ON companies(setup_completed);

-- ============================================================================
-- HELPER FUNCTIONS (Create these first, before RLS policies)
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's active company
CREATE OR REPLACE FUNCTION get_active_company(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT id INTO v_company_id
  FROM companies
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN v_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_companies_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Create last
-- ============================================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Users can view their own companies
CREATE POLICY "Users can view their own companies"
  ON companies FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own companies
CREATE POLICY "Users can create their own companies"
  ON companies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own companies
CREATE POLICY "Users can update their own companies"
  ON companies FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own companies
CREATE POLICY "Users can delete their own companies"
  ON companies FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify table was created
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'companies' 
ORDER BY ordinal_position;

