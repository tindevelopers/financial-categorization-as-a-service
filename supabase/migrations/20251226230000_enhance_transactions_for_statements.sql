-- Migration: Enhance Transactions for Financial Statements
-- Description: Add transaction type, direction, and additional metadata fields to categorized_transactions
-- Created: 2025-12-27

-- Add transaction type and direction fields
ALTER TABLE categorized_transactions
  ADD COLUMN IF NOT EXISTS transaction_type TEXT 
    CHECK (transaction_type IN ('debit', 'credit', 'interest', 'fee', 'transfer', 'deposit', 'withdrawal', 'payment', 'refund'));

ALTER TABLE categorized_transactions
  ADD COLUMN IF NOT EXISTS is_debit BOOLEAN;

ALTER TABLE categorized_transactions
  ADD COLUMN IF NOT EXISTS running_balance DECIMAL(12,2);

ALTER TABLE categorized_transactions
  ADD COLUMN IF NOT EXISTS posted_date DATE;

ALTER TABLE categorized_transactions
  ADD COLUMN IF NOT EXISTS reference_number TEXT;

ALTER TABLE categorized_transactions
  ADD COLUMN IF NOT EXISTS merchant_category_code TEXT;

-- Create function to automatically set is_debit based on transaction_type and amount
CREATE OR REPLACE FUNCTION set_transaction_debit_flag()
RETURNS TRIGGER AS $$
BEGIN
  -- Set is_debit based on transaction_type
  IF NEW.transaction_type IN ('debit', 'withdrawal', 'payment', 'fee') THEN
    NEW.is_debit := TRUE;
  ELSIF NEW.transaction_type IN ('credit', 'deposit', 'refund', 'interest') THEN
    NEW.is_debit := FALSE;
  ELSIF NEW.transaction_type = 'transfer' THEN
    -- For transfers, check amount sign or leave NULL
    NEW.is_debit := NULL;
  END IF;
  
  -- If amount is negative, it's likely a debit (money out)
  -- If amount is positive, it's likely a credit (money in)
  -- But we prioritize transaction_type if set
  IF NEW.is_debit IS NULL AND NEW.amount < 0 THEN
    NEW.is_debit := TRUE;
  ELSIF NEW.is_debit IS NULL AND NEW.amount > 0 THEN
    NEW.is_debit := FALSE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-set is_debit
DROP TRIGGER IF EXISTS trigger_set_transaction_debit_flag ON categorized_transactions;
CREATE TRIGGER trigger_set_transaction_debit_flag
  BEFORE INSERT OR UPDATE OF transaction_type, amount ON categorized_transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_transaction_debit_flag();

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_categorized_transactions_transaction_type 
  ON categorized_transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_is_debit 
  ON categorized_transactions(is_debit);

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_posted_date 
  ON categorized_transactions(posted_date DESC);

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_reference_number 
  ON categorized_transactions(reference_number);

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_merchant_category_code 
  ON categorized_transactions(merchant_category_code);

-- Comments for documentation
COMMENT ON COLUMN categorized_transactions.transaction_type IS 'Type of transaction: debit, credit, interest, fee, transfer, deposit, withdrawal, payment, refund';
COMMENT ON COLUMN categorized_transactions.is_debit IS 'TRUE if transaction reduces account balance (money out), FALSE if increases (money in)';
COMMENT ON COLUMN categorized_transactions.running_balance IS 'Account balance after this transaction';
COMMENT ON COLUMN categorized_transactions.posted_date IS 'Date when transaction was posted to account (may differ from transaction date)';
COMMENT ON COLUMN categorized_transactions.reference_number IS 'Check number, reference ID, or other transaction identifier';
COMMENT ON COLUMN categorized_transactions.merchant_category_code IS 'MCC code from card processor or bank';

