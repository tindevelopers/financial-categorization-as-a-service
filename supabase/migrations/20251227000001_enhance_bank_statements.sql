-- Migration: Enhance Bank Statements
-- Description: Add opening/closing balance fields to financial_documents and create bank_statement_metadata table
-- Created: 2025-12-27

-- Enhance financial_documents table for bank statements
ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(12,2);

ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS closing_balance DECIMAL(12,2);

ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS statement_period_start DATE;

ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS statement_period_end DATE;

ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS account_number TEXT;

ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS statement_type TEXT 
    CHECK (statement_type IN ('monthly', 'quarterly', 'annual', 'custom'));

-- Create bank_statement_metadata table
CREATE TABLE IF NOT EXISTS bank_statement_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_document_id UUID NOT NULL REFERENCES financial_documents(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  statement_number TEXT,
  opening_balance DECIMAL(12,2) NOT NULL,
  closing_balance DECIMAL(12,2) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  currency TEXT DEFAULT 'GBP',
  transaction_count INTEGER,
  total_debits DECIMAL(12,2),
  total_credits DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one metadata record per financial document
  UNIQUE(financial_document_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bank_statement_metadata_financial_document_id 
  ON bank_statement_metadata(financial_document_id);

CREATE INDEX IF NOT EXISTS idx_bank_statement_metadata_bank_account_id 
  ON bank_statement_metadata(bank_account_id);

CREATE INDEX IF NOT EXISTS idx_bank_statement_metadata_period 
  ON bank_statement_metadata(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_financial_documents_opening_balance 
  ON financial_documents(opening_balance) WHERE opening_balance IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_documents_closing_balance 
  ON financial_documents(closing_balance) WHERE closing_balance IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_documents_statement_period 
  ON financial_documents(statement_period_start, statement_period_end) 
  WHERE statement_period_start IS NOT NULL;

-- Create function to sync financial_documents balance fields from bank_statement_metadata
CREATE OR REPLACE FUNCTION sync_statement_balances()
RETURNS TRIGGER AS $$
BEGIN
  -- Update financial_documents when bank_statement_metadata is created/updated
  UPDATE financial_documents
  SET
    opening_balance = NEW.opening_balance,
    closing_balance = NEW.closing_balance,
    statement_period_start = NEW.period_start,
    statement_period_end = NEW.period_end,
    account_number = COALESCE(
      (SELECT account_number FROM bank_accounts WHERE id = NEW.bank_account_id),
      financial_documents.account_number
    )
  WHERE id = NEW.financial_document_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync balances
DROP TRIGGER IF EXISTS trigger_sync_statement_balances ON bank_statement_metadata;
CREATE TRIGGER trigger_sync_statement_balances
  AFTER INSERT OR UPDATE ON bank_statement_metadata
  FOR EACH ROW
  EXECUTE FUNCTION sync_statement_balances();

-- Enable RLS on bank_statement_metadata
ALTER TABLE bank_statement_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bank_statement_metadata
CREATE POLICY "Users can view their own bank statement metadata"
  ON bank_statement_metadata FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM financial_documents fd
      WHERE fd.id = bank_statement_metadata.financial_document_id
      AND fd.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create bank statement metadata for their documents"
  ON bank_statement_metadata FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM financial_documents fd
      WHERE fd.id = bank_statement_metadata.financial_document_id
      AND fd.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own bank statement metadata"
  ON bank_statement_metadata FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM financial_documents fd
      WHERE fd.id = bank_statement_metadata.financial_document_id
      AND fd.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own bank statement metadata"
  ON bank_statement_metadata FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM financial_documents fd
      WHERE fd.id = bank_statement_metadata.financial_document_id
      AND fd.user_id = auth.uid()
    )
  );

-- Platform admins can manage all bank statement metadata
CREATE POLICY "Platform admins can manage all bank statement metadata"
  ON bank_statement_metadata FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Trigger for updated_at
CREATE TRIGGER update_bank_statement_metadata_updated_at
  BEFORE UPDATE ON bank_statement_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE bank_statement_metadata IS 'Metadata extracted from bank statements including opening/closing balances and transaction summaries';
COMMENT ON COLUMN bank_statement_metadata.opening_balance IS 'Account balance at the start of the statement period';
COMMENT ON COLUMN bank_statement_metadata.closing_balance IS 'Account balance at the end of the statement period';
COMMENT ON COLUMN bank_statement_metadata.total_debits IS 'Sum of all debit transactions in the statement period';
COMMENT ON COLUMN bank_statement_metadata.total_credits IS 'Sum of all credit transactions in the statement period';
COMMENT ON COLUMN financial_documents.opening_balance IS 'Opening balance from bank statement (synced from bank_statement_metadata)';
COMMENT ON COLUMN financial_documents.closing_balance IS 'Closing balance from bank statement (synced from bank_statement_metadata)';
COMMENT ON COLUMN financial_documents.statement_type IS 'Frequency of statement: monthly, quarterly, annual, or custom';

