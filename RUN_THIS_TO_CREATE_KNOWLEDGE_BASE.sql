-- Repair Script: Create knowledge_base table and related objects
-- Run this in Supabase SQL Editor if the table is missing

-- ============================================
-- 1. Enable pgvector extension (if not already enabled)
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 2. Ensure update_updated_at_column function exists
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. Create Knowledge Base Table
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL, -- 'hmrc', 'vat', 'accounting', 'app_help'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(category, title)
);

-- ============================================
-- 4. Create Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tags ON knowledge_base USING gin(tags);

-- ============================================
-- 5. Enable RLS
-- ============================================
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. Create RLS Policy
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read knowledge base" ON knowledge_base;
CREATE POLICY "Authenticated users can read knowledge base"
  ON knowledge_base FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- ============================================
-- 7. Create Trigger
-- ============================================
DROP TRIGGER IF EXISTS update_knowledge_base_updated_at ON knowledge_base;
CREATE TRIGGER update_knowledge_base_updated_at
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. Seed Initial Knowledge Base
-- ============================================
INSERT INTO knowledge_base (category, title, content, tags) VALUES
-- HMRC Categories
('hmrc', 'Allowable Business Expenses', 
 'Allowable business expenses are costs that can be deducted from income to reduce taxable profit. Common categories include: Office costs (stationery, phone bills), Travel costs (fuel, parking, train fares for business travel), Clothing expenses (uniforms), Staff costs (salaries, subcontractor costs), Financial costs (bank charges, insurance), Costs of premises (rent, utilities), Advertising and marketing costs, Training courses related to your business.',
 ARRAY['expenses', 'deductions', 'tax']),

('hmrc', 'Disallowable Expenses', 
 'Disallowable expenses cannot be deducted from taxable profit. These include: Entertainment costs (client dinners, hospitality), Personal expenses, Fines and penalties, Political donations, Non-business travel, Personal portion of dual-use items.',
 ARRAY['expenses', 'non-deductible', 'tax']),

('hmrc', 'Capital Allowances', 
 'Capital allowances let you deduct the cost of business assets from profits. Annual Investment Allowance (AIA) provides 100% first-year relief up to £1 million. Writing Down Allowance (WDA) at 18% for main pool items or 6% for special rate pool. First Year Allowances at 100% for qualifying energy-efficient equipment.',
 ARRAY['capital', 'assets', 'allowances', 'aia']),

-- VAT Guidance
('vat', 'VAT Registration Threshold', 
 'You must register for VAT if your taxable turnover exceeds £90,000 in any 12-month period (as of April 2024). Voluntary registration is possible below this threshold. VAT registration allows you to reclaim VAT on business purchases.',
 ARRAY['vat', 'registration', 'threshold']),

('vat', 'VAT Rates', 
 'Standard rate: 20% applies to most goods and services. Reduced rate: 5% applies to some goods like home energy, children car seats. Zero rate: 0% applies to most food, books, children clothing, public transport. Exempt: No VAT charged, includes financial services, insurance, education.',
 ARRAY['vat', 'rates', 'standard', 'reduced', 'zero']),

('vat', 'Flat Rate VAT Scheme', 
 'Small businesses can use the Flat Rate Scheme if turnover is under £150,000 (excluding VAT). You pay a fixed percentage of turnover based on your business sector. First-year discount of 1% available. Cannot reclaim VAT on purchases except capital assets over £2,000.',
 ARRAY['vat', 'flat-rate', 'small-business']),

-- Accounting Guidance  
('accounting', 'Cash vs Accrual Accounting', 
 'Cash basis: Record income when received and expenses when paid. Simpler for small businesses. Available if turnover under £150,000. Accrual basis: Record income when earned and expenses when incurred. Required for larger businesses. Better matches income to related expenses.',
 ARRAY['accounting', 'cash-basis', 'accrual']),

('accounting', 'Record Keeping Requirements', 
 'HMRC requires you to keep records for at least 5 years (6 years for companies). Records must include: All sales and income, All purchases and expenses, VAT records if registered, PAYE records if you have employees, Bank statements, Invoices issued and received.',
 ARRAY['records', 'compliance', 'hmrc']),

('accounting', 'Common Expense Categories', 
 'Standard expense categories for UK businesses: Cost of Sales (materials, stock), Office Costs, Travel & Subsistence, Motor Expenses, Professional Fees (accountant, legal), Marketing & Advertising, Bank Charges, Insurance, Subscriptions, Training, Utilities, Repairs & Maintenance, Equipment (under capital threshold).',
 ARRAY['categories', 'expenses', 'bookkeeping']),

-- App Help
('app_help', 'How to Categorize Transactions', 
 'FinCat uses AI to automatically categorize your transactions. Upload a bank statement or spreadsheet, and the AI will suggest categories based on the transaction description and amount. You can review and confirm suggestions, or manually override them. Your corrections help train the AI for better future suggestions.',
 ARRAY['categorization', 'ai', 'transactions', 'help']),

('app_help', 'Google Sheets Integration', 
 'Connect your Google Sheets to sync transactions bidirectionally. Pull: Import transactions from your spreadsheet. Push: Export categorized transactions to your sheet. Sync: Keep both in sync with conflict detection. Configure column mappings in Settings > Integrations.',
 ARRAY['sheets', 'integration', 'sync', 'help']),

('app_help', 'Reconciliation Process', 
 'Reconciliation matches your categorized transactions against bank statements. Upload a bank statement to compare. FinCat highlights matched, unmatched, and discrepant items. Mark items as reconciled once verified. Use the reconciliation report for your accountant.',
 ARRAY['reconciliation', 'bank', 'matching', 'help'])

ON CONFLICT (category, title) DO NOTHING;

