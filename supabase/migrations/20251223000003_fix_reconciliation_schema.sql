-- Migration: Fix Reconciliation Schema
-- Description: Add tax breakdown fields and fix foreign keys to use financial_documents
-- Created: 2025-12-23

-- Add tax breakdown fields to financial_documents
ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS subtotal_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS fee_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS net_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS line_items JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS po_number TEXT;

-- Add reconciliation fields if they don't exist
ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'unreconciled' CHECK (reconciliation_status IN ('unreconciled', 'matched', 'partial', 'excluded')),
  ADD COLUMN IF NOT EXISTS matched_transaction_id UUID,
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT;

-- Add foreign key constraint for matched_transaction_id
ALTER TABLE financial_documents
  DROP CONSTRAINT IF EXISTS financial_documents_matched_transaction_id_fkey;

ALTER TABLE financial_documents
  ADD CONSTRAINT financial_documents_matched_transaction_id_fkey 
    FOREIGN KEY (matched_transaction_id) REFERENCES categorized_transactions(id) ON DELETE SET NULL;

-- Fix foreign key on categorized_transactions to use financial_documents
ALTER TABLE categorized_transactions 
  DROP CONSTRAINT IF EXISTS categorized_transactions_matched_document_id_fkey;

ALTER TABLE categorized_transactions 
  ADD CONSTRAINT categorized_transactions_matched_document_id_fkey 
    FOREIGN KEY (matched_document_id) REFERENCES financial_documents(id) ON DELETE SET NULL;

-- Create indexes for reconciliation queries
CREATE INDEX IF NOT EXISTS idx_financial_documents_reconciliation_status 
  ON financial_documents(reconciliation_status);

CREATE INDEX IF NOT EXISTS idx_financial_documents_matched_transaction_id 
  ON financial_documents(matched_transaction_id) WHERE matched_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_reconciliation_status 
  ON categorized_transactions(reconciliation_status);

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_matched_document_id 
  ON categorized_transactions(matched_document_id) WHERE matched_document_id IS NOT NULL;

-- Drop old reconciliation view if it exists
DROP VIEW IF EXISTS reconciliation_candidates;

-- Create updated reconciliation view with tax breakdown
CREATE VIEW reconciliation_candidates AS
SELECT 
  t.id as transaction_id,
  t.original_description,
  t.amount as transaction_amount,
  t.date as transaction_date,
  t.reconciliation_status as transaction_reconciliation_status,
  t.category as transaction_category,
  t.job_id,
  d.id as document_id,
  d.vendor_name,
  d.total_amount as document_total_amount,
  d.document_date as invoice_date,
  d.original_filename,
  d.subtotal_amount,
  d.tax_amount,
  d.fee_amount,
  d.net_amount,
  d.tax_rate,
  d.line_items,
  d.payment_method,
  d.po_number,
  d.reconciliation_status as document_reconciliation_status,
  -- Calculate amount difference
  ABS(t.amount - COALESCE(d.total_amount, 0)) as amount_difference,
  -- Calculate days difference (date subtraction in PostgreSQL returns integer days)
  ABS(t.date - COALESCE(d.document_date, t.date)) as days_difference,
  -- Match confidence calculation
  CASE 
    WHEN ABS(t.amount - COALESCE(d.total_amount, 0)) < 0.01 
         AND ABS(t.date - COALESCE(d.document_date, t.date)) <= 7 
    THEN 'high'
    WHEN ABS(t.amount - COALESCE(d.total_amount, 0)) < 1.00
         AND ABS(t.date - COALESCE(d.document_date, t.date)) <= 30
    THEN 'medium'
    ELSE 'low'
  END as match_confidence
FROM categorized_transactions t
CROSS JOIN financial_documents d
WHERE t.reconciliation_status = 'unreconciled'
  AND d.reconciliation_status = 'unreconciled'
  AND t.matched_document_id IS NULL
  AND d.matched_transaction_id IS NULL
  AND ABS(t.amount - COALESCE(d.total_amount, 0)) < 100
  AND ABS(t.date - COALESCE(d.document_date, t.date)) <= 60
ORDER BY 
  CASE 
    WHEN ABS(t.amount - COALESCE(d.total_amount, 0)) < 0.01 THEN 1
    WHEN ABS(t.amount - COALESCE(d.total_amount, 0)) < 1.00 THEN 2
    ELSE 3
  END,
  ABS(t.date - COALESCE(d.document_date, t.date));

-- Update existing SQL functions to use financial_documents
-- Drop and recreate match_transaction_with_document function
DROP FUNCTION IF EXISTS match_transaction_with_document(UUID, UUID);

CREATE OR REPLACE FUNCTION match_transaction_with_document(
  p_transaction_id UUID,
  p_document_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_transaction_user_id UUID;
  v_document_user_id UUID;
  v_result JSONB;
BEGIN
  -- Get user_id from transaction (via job_id)
  SELECT cj.user_id INTO v_transaction_user_id
  FROM categorized_transactions ct
  JOIN categorization_jobs cj ON ct.job_id = cj.id
  WHERE ct.id = p_transaction_id;

  -- Get user_id from document
  SELECT user_id INTO v_document_user_id
  FROM financial_documents
  WHERE id = p_document_id;

  -- Verify both belong to same user
  IF v_transaction_user_id IS NULL OR v_document_user_id IS NULL THEN
    RAISE EXCEPTION 'Transaction or document not found';
  END IF;

  IF v_transaction_user_id != v_document_user_id THEN
    RAISE EXCEPTION 'Transaction and document belong to different users';
  END IF;

  -- Check if already matched
  IF EXISTS (
    SELECT 1 FROM categorized_transactions 
    WHERE id = p_transaction_id AND matched_document_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Transaction is already matched';
  END IF;

  IF EXISTS (
    SELECT 1 FROM financial_documents 
    WHERE id = p_document_id AND matched_transaction_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Document is already matched';
  END IF;

  -- Update transaction
  UPDATE categorized_transactions
  SET 
    matched_document_id = p_document_id,
    reconciliation_status = 'matched',
    reconciled_at = NOW()
  WHERE id = p_transaction_id;

  -- Update document
  UPDATE financial_documents
  SET 
    matched_transaction_id = p_transaction_id,
    reconciliation_status = 'matched',
    reconciled_at = NOW(),
    reconciled_by = v_document_user_id
  WHERE id = p_document_id;

  -- Return success
  v_result := jsonb_build_object(
    'success', true,
    'transaction_id', p_transaction_id,
    'document_id', p_document_id,
    'matched_at', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate unmatch_transaction function
DROP FUNCTION IF EXISTS unmatch_transaction(UUID);

CREATE OR REPLACE FUNCTION unmatch_transaction(
  p_transaction_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_document_id UUID;
  v_result JSONB;
BEGIN
  -- Get matched document_id
  SELECT matched_document_id INTO v_document_id
  FROM categorized_transactions
  WHERE id = p_transaction_id;

  IF v_document_id IS NULL THEN
    RAISE EXCEPTION 'Transaction is not matched to any document';
  END IF;

  -- Update transaction
  UPDATE categorized_transactions
  SET 
    matched_document_id = NULL,
    reconciliation_status = 'unreconciled',
    reconciled_at = NULL
  WHERE id = p_transaction_id;

  -- Update document
  UPDATE financial_documents
  SET 
    matched_transaction_id = NULL,
    reconciliation_status = 'unreconciled',
    reconciled_at = NULL,
    reconciled_by = NULL
  WHERE id = v_document_id;

  -- Return success
  v_result := jsonb_build_object(
    'success', true,
    'transaction_id', p_transaction_id,
    'document_id', v_document_id,
    'unmatched_at', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON COLUMN financial_documents.subtotal_amount IS 'Subtotal amount before tax and fees';
COMMENT ON COLUMN financial_documents.tax_amount IS 'Tax amount (e.g., VAT, sales tax)';
COMMENT ON COLUMN financial_documents.fee_amount IS 'Additional fees (e.g., service charges, tips)';
COMMENT ON COLUMN financial_documents.net_amount IS 'Net amount after tax and fees';
COMMENT ON COLUMN financial_documents.tax_rate IS 'Tax rate as percentage (e.g., 20 for 20%)';
COMMENT ON COLUMN financial_documents.line_items IS 'Array of line items extracted from invoice';
COMMENT ON COLUMN financial_documents.payment_method IS 'Payment method used (e.g., credit card, cash)';
COMMENT ON COLUMN financial_documents.po_number IS 'Purchase order number';
COMMENT ON VIEW reconciliation_candidates IS 'View showing potential matches between unreconciled transactions and documents';

