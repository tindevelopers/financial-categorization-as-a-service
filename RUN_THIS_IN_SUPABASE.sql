-- ============================================================================
-- SAFE MIGRATION - Handles Existing Objects
-- Copy and paste this entire block into Supabase SQL Editor
-- ============================================================================

-- Drop existing triggers and policies first
DROP TRIGGER IF EXISTS company_profiles_updated_at ON company_profiles;
DROP POLICY IF EXISTS "Users can view their own company profiles" ON company_profiles;
DROP POLICY IF EXISTS "Users can create their own company profiles" ON company_profiles;
DROP POLICY IF EXISTS "Users can update their own company profiles" ON company_profiles;
DROP POLICY IF EXISTS "Users can delete their own company profiles" ON company_profiles;

-- Drop existing functions
DROP FUNCTION IF EXISTS update_company_profiles_updated_at() CASCADE;
DROP FUNCTION IF EXISTS get_active_company_profile(UUID) CASCADE;

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS company_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_type TEXT NOT NULL CHECK (company_type IN ('sole_trader', 'limited_company', 'partnership', 'individual')),
  company_number TEXT,
  vat_registered BOOLEAN DEFAULT FALSE,
  vat_number TEXT,
  vat_scheme TEXT CHECK (vat_scheme IN ('standard', 'flat_rate', 'cash_accounting', NULL)),
  flat_rate_percentage DECIMAL(4,2),
  financial_year_end DATE,
  accounting_basis TEXT DEFAULT 'cash' CHECK (accounting_basis IN ('cash', 'accrual')),
  default_currency TEXT DEFAULT 'GBP',
  address JSONB DEFAULT '{}'::jsonb,
  contact_details JSONB DEFAULT '{}'::jsonb,
  bank_accounts JSONB DEFAULT '[]'::jsonb,
  setup_completed BOOLEAN DEFAULT FALSE,
  setup_step INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_company_profiles_user_id ON company_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_company_profiles_setup_completed ON company_profiles(setup_completed);

-- Create function
CREATE OR REPLACE FUNCTION update_company_profiles_updated_at()
RETURNS TRIGGER AS $$ 
BEGIN 
  NEW.updated_at = NOW(); 
  RETURN NEW; 
END; 
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER company_profiles_updated_at 
  BEFORE UPDATE ON company_profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_company_profiles_updated_at();

-- Create helper function
CREATE OR REPLACE FUNCTION get_active_company_profile(p_user_id UUID)
RETURNS UUID AS $$
DECLARE v_company_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM company_profiles
  WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 1;
  RETURN v_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own company profiles"
  ON company_profiles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own company profiles"
  ON company_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own company profiles"
  ON company_profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own company profiles"
  ON company_profiles FOR DELETE USING (auth.uid() = user_id);

-- Verify success
SELECT 'Migration completed successfully!' as status;
SELECT COUNT(*) as column_count FROM information_schema.columns WHERE table_name = 'company_profiles';

