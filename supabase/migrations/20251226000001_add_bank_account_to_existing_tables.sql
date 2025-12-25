-- Migration: Add Bank Account Foreign Keys to Existing Tables
-- Description: Link categorization_jobs, financial_documents, and categorized_transactions to bank_accounts
-- Created: 2025-12-26

-- ============================================================================
-- ADD BANK_ACCOUNT_ID TO CATEGORIZATION_JOBS
-- ============================================================================

ALTER TABLE categorization_jobs
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL;

ALTER TABLE categorization_jobs
ADD COLUMN IF NOT EXISTS spreadsheet_id TEXT;

ALTER TABLE categorization_jobs
ADD COLUMN IF NOT EXISTS spreadsheet_tab_id TEXT;

-- Indexes for categorization_jobs
CREATE INDEX IF NOT EXISTS idx_categorization_jobs_bank_account_id ON categorization_jobs(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_categorization_jobs_spreadsheet_id ON categorization_jobs(spreadsheet_id);

-- ============================================================================
-- ADD BANK_ACCOUNT_ID TO FINANCIAL_DOCUMENTS
-- ============================================================================

ALTER TABLE financial_documents
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL;

-- Index for financial_documents
CREATE INDEX IF NOT EXISTS idx_financial_documents_bank_account_id ON financial_documents(bank_account_id);

-- ============================================================================
-- ADD BANK_ACCOUNT_ID TO CATEGORIZED_TRANSACTIONS
-- ============================================================================

ALTER TABLE categorized_transactions
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL;

-- Index for categorized_transactions
CREATE INDEX IF NOT EXISTS idx_categorized_transactions_bank_account_id ON categorized_transactions(bank_account_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN categorization_jobs.bank_account_id IS 'Bank account associated with this upload/job';
COMMENT ON COLUMN categorization_jobs.spreadsheet_id IS 'Google Sheets spreadsheet ID where transactions are synced';
COMMENT ON COLUMN categorization_jobs.spreadsheet_tab_id IS 'Tab name/ID within the spreadsheet';
COMMENT ON COLUMN financial_documents.bank_account_id IS 'Bank account associated with this document';
COMMENT ON COLUMN categorized_transactions.bank_account_id IS 'Bank account associated with this transaction';

