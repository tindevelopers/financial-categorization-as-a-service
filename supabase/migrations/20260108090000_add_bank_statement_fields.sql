-- Migration: Add bank statement source columns and counterparty fields
-- Created: 2026-01-08
-- Purpose: Preserve source statement columns (payee/payer, reference, bank category/type, paid in/out)
--          and support counterparty reporting.

ALTER TABLE categorized_transactions
  ADD COLUMN IF NOT EXISTS payee_name TEXT,
  ADD COLUMN IF NOT EXISTS payer_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_description_reference TEXT,
  ADD COLUMN IF NOT EXISTS bank_transaction_type TEXT,
  ADD COLUMN IF NOT EXISTS bank_category TEXT,
  ADD COLUMN IF NOT EXISTS bank_subcategory TEXT,
  ADD COLUMN IF NOT EXISTS paid_in_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS paid_out_amount DECIMAL(12,2);

-- Indexes to speed counterparty and counterparty-by-date lookups
CREATE INDEX IF NOT EXISTS idx_categorized_transactions_payee_name
  ON categorized_transactions(payee_name);

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_payer_name
  ON categorized_transactions(payer_name);

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_date_payee_name
  ON categorized_transactions(date, payee_name);

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_date_payer_name
  ON categorized_transactions(date, payer_name);

COMMENT ON COLUMN categorized_transactions.payee_name IS 'Payee when money flows out (debit).';
COMMENT ON COLUMN categorized_transactions.payer_name IS 'Payer when money flows in (credit).';
COMMENT ON COLUMN categorized_transactions.payment_description_reference IS 'Raw payment description/reference from statement.';
COMMENT ON COLUMN categorized_transactions.bank_transaction_type IS 'Raw transaction type string from the bank statement.';
COMMENT ON COLUMN categorized_transactions.bank_category IS 'Bank-provided category.';
COMMENT ON COLUMN categorized_transactions.bank_subcategory IS 'Bank-provided subcategory.';
COMMENT ON COLUMN categorized_transactions.paid_in_amount IS 'Source paid-in amount (money in), as on the statement.';
COMMENT ON COLUMN categorized_transactions.paid_out_amount IS 'Source paid-out amount (money out), as on the statement.';

