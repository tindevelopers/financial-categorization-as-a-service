-- Migration: Create Chart of Accounts
-- Description: Standard chart of accounts structure for UK accounting with HMRC compliance
-- Created: 2025-12-27

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL, -- e.g., "1000", "4000", "5000"
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL 
    CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  parent_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  tax_code TEXT, -- For VAT/tax categorization
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique account codes per company
  UNIQUE(company_profile_id, account_code)
);

-- Create mapping table to link categories to chart of accounts
CREATE TABLE IF NOT EXISTS category_account_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  subcategory TEXT,
  account_code TEXT NOT NULL,
  chart_of_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index for category mapping (handles NULL subcategory)
CREATE UNIQUE INDEX IF NOT EXISTS idx_category_account_mapping_unique 
  ON category_account_mapping(company_profile_id, category, COALESCE(subcategory, ''));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_company_profile_id 
  ON chart_of_accounts(company_profile_id, is_active);

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_account_code 
  ON chart_of_accounts(account_code);

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_account_type 
  ON chart_of_accounts(account_type);

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent 
  ON chart_of_accounts(parent_account_id) 
  WHERE parent_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_category_account_mapping_company 
  ON category_account_mapping(company_profile_id, category);

CREATE INDEX IF NOT EXISTS idx_category_account_mapping_account 
  ON category_account_mapping(chart_of_account_id);

-- Enable RLS
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_account_mapping ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chart_of_accounts
CREATE POLICY "Users can view chart of accounts for their companies"
  ON chart_of_accounts FOR SELECT
  USING (
    company_profile_id IN (
      SELECT id FROM company_profiles 
      WHERE user_id = auth.uid() OR tenant_id IN (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create chart of accounts for their companies"
  ON chart_of_accounts FOR INSERT
  WITH CHECK (
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update chart of accounts for their companies"
  ON chart_of_accounts FOR UPDATE
  USING (
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete chart of accounts for their companies"
  ON chart_of_accounts FOR DELETE
  USING (
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for category_account_mapping
CREATE POLICY "Users can view category mappings for their companies"
  ON category_account_mapping FOR SELECT
  USING (
    company_profile_id IN (
      SELECT id FROM company_profiles 
      WHERE user_id = auth.uid() OR tenant_id IN (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create category mappings for their companies"
  ON category_account_mapping FOR INSERT
  WITH CHECK (
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update category mappings for their companies"
  ON category_account_mapping FOR UPDATE
  USING (
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete category mappings for their companies"
  ON category_account_mapping FOR DELETE
  USING (
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE user_id = auth.uid()
    )
  );

-- Platform admins can manage all chart of accounts
CREATE POLICY "Platform admins can manage all chart of accounts"
  ON chart_of_accounts FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Platform admins can manage all category mappings"
  ON category_account_mapping FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Triggers for updated_at
CREATE TRIGGER update_chart_of_accounts_updated_at
  BEFORE UPDATE ON chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_category_account_mapping_updated_at
  BEFORE UPDATE ON category_account_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create default UK chart of accounts
CREATE OR REPLACE FUNCTION create_default_uk_chart_of_accounts(
  p_company_profile_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Assets (1000-1999)
  INSERT INTO chart_of_accounts (company_profile_id, account_code, account_name, account_type) VALUES
    (p_company_profile_id, '1000', 'Current Assets', 'asset'),
    (p_company_profile_id, '1100', 'Bank Account', 'asset'),
    (p_company_profile_id, '1200', 'Accounts Receivable', 'asset'),
    (p_company_profile_id, '1300', 'Inventory', 'asset'),
    (p_company_profile_id, '1400', 'Prepaid Expenses', 'asset'),
    (p_company_profile_id, '1500', 'Fixed Assets', 'asset'),
    (p_company_profile_id, '1600', 'Accumulated Depreciation', 'asset'),
    (p_company_profile_id, '1700', 'Intangible Assets', 'asset');
  
  -- Liabilities (2000-2999)
  INSERT INTO chart_of_accounts (company_profile_id, account_code, account_name, account_type) VALUES
    (p_company_profile_id, '2000', 'Current Liabilities', 'liability'),
    (p_company_profile_id, '2100', 'Accounts Payable', 'liability'),
    (p_company_profile_id, '2200', 'Accrued Expenses', 'liability'),
    (p_company_profile_id, '2300', 'VAT Payable', 'liability'),
    (p_company_profile_id, '2400', 'Tax Payable', 'liability'),
    (p_company_profile_id, '2500', 'Long-term Liabilities', 'liability');
  
  -- Equity (3000-3999)
  INSERT INTO chart_of_accounts (company_profile_id, account_code, account_name, account_type) VALUES
    (p_company_profile_id, '3000', 'Equity', 'equity'),
    (p_company_profile_id, '3100', 'Share Capital', 'equity'),
    (p_company_profile_id, '3200', 'Retained Earnings', 'equity'),
    (p_company_profile_id, '3300', 'Current Year Earnings', 'equity');
  
  -- Income (4000-4999)
  INSERT INTO chart_of_accounts (company_profile_id, account_code, account_name, account_type) VALUES
    (p_company_profile_id, '4000', 'Revenue', 'income'),
    (p_company_profile_id, '4100', 'Sales Revenue', 'income'),
    (p_company_profile_id, '4200', 'Service Revenue', 'income'),
    (p_company_profile_id, '4300', 'Other Income', 'income');
  
  -- Expenses (5000-6999)
  INSERT INTO chart_of_accounts (company_profile_id, account_code, account_name, account_type) VALUES
    (p_company_profile_id, '5000', 'Cost of Goods Sold', 'expense'),
    (p_company_profile_id, '5100', 'Direct Costs', 'expense'),
    (p_company_profile_id, '6000', 'Operating Expenses', 'expense'),
    (p_company_profile_id, '6100', 'Office Expenses', 'expense'),
    (p_company_profile_id, '6200', 'Travel Expenses', 'expense'),
    (p_company_profile_id, '6300', 'Marketing Expenses', 'expense'),
    (p_company_profile_id, '6400', 'Professional Fees', 'expense'),
    (p_company_profile_id, '6500', 'Utilities', 'expense'),
    (p_company_profile_id, '6600', 'Insurance', 'expense'),
    (p_company_profile_id, '6700', 'Depreciation', 'expense'),
    (p_company_profile_id, '7000', 'Finance Costs', 'expense'),
    (p_company_profile_id, '7100', 'Interest Expense', 'expense'),
    (p_company_profile_id, '8000', 'Tax Expense', 'expense');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_default_uk_chart_of_accounts TO authenticated;

-- Comments for documentation
COMMENT ON TABLE chart_of_accounts IS 'Chart of accounts for each company profile, following UK accounting standards';
COMMENT ON COLUMN chart_of_accounts.account_code IS 'Account code following standard numbering (1000s=assets, 2000s=liabilities, 3000s=equity, 4000s=income, 5000s+=expenses)';
COMMENT ON COLUMN chart_of_accounts.account_type IS 'Type of account: asset, liability, equity, income, or expense';
COMMENT ON COLUMN chart_of_accounts.tax_code IS 'Tax/VAT code for HMRC reporting';
COMMENT ON TABLE category_account_mapping IS 'Maps transaction categories to chart of accounts for financial statement generation';
COMMENT ON FUNCTION create_default_uk_chart_of_accounts IS 'Creates a default UK chart of accounts for a company profile';

