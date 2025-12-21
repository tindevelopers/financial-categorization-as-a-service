-- Migration: Add Reconciliation Support
-- Adds fields to support transaction reconciliation
-- Created: 2025-12-21

-- Add reconciliation fields to categorized_transactions
ALTER TABLE categorized_transactions 
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'unreconciled' 
    CHECK (reconciliation_status IN ('unreconciled', 'matched', 'partial', 'excluded')),
  ADD COLUMN IF NOT EXISTS matched_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT;

-- Add reconciliation fields to documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'unreconciled'
    CHECK (reconciliation_status IN ('unreconciled', 'matched', 'partial', 'excluded')),
  ADD COLUMN IF NOT EXISTS matched_transaction_id UUID REFERENCES categorized_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create indexes for reconciliation queries
CREATE INDEX IF NOT EXISTS idx_categorized_transactions_reconciliation_status 
  ON categorized_transactions(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_categorized_transactions_matched_document 
  ON categorized_transactions(matched_document_id);
CREATE INDEX IF NOT EXISTS idx_documents_reconciliation_status 
  ON documents(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_documents_matched_transaction 
  ON documents(matched_transaction_id);

-- Create a view for easy reconciliation matching
CREATE OR REPLACE VIEW reconciliation_candidates AS
SELECT 
  t.id as transaction_id,
  t.original_description as transaction_description,
  t.amount as transaction_amount,
  t.date as transaction_date,
  t.reconciliation_status as transaction_status,
  t.matched_document_id,
  d.id as document_id,
  d.vendor_name as document_vendor,
  d.total_amount as document_amount,
  d.invoice_date as document_date,
  d.original_filename as document_filename,
  d.reconciliation_status as document_status,
  -- Calculate match score based on amount and date proximity
  CASE 
    WHEN ABS(t.amount - COALESCE(d.total_amount, 0)) < 0.01 
         AND ABS(t.date - COALESCE(d.invoice_date, t.date)) <= 7 
    THEN 'high'
    WHEN ABS(t.amount - COALESCE(d.total_amount, 0)) < 1.00
         AND ABS(t.date - COALESCE(d.invoice_date, t.date)) <= 30
    THEN 'medium'
    ELSE 'low'
  END as match_confidence,
  ABS(t.amount - COALESCE(d.total_amount, 0)) as amount_difference,
  ABS(t.date - COALESCE(d.invoice_date, t.date)) as days_difference
FROM categorized_transactions t
LEFT JOIN documents d ON d.matched_transaction_id IS NULL 
  AND d.reconciliation_status = 'unreconciled'
  AND ABS(t.amount - COALESCE(d.total_amount, 0)) < 100 -- Only consider close matches
  AND ABS(t.date - COALESCE(d.invoice_date, t.date)) <= 60 -- Within 60 days
WHERE t.reconciliation_status = 'unreconciled';

-- Grant access to the view (will be controlled by RLS on underlying tables)
GRANT SELECT ON reconciliation_candidates TO authenticated;

-- Function to match transaction with document
CREATE OR REPLACE FUNCTION match_transaction_with_document(
  p_transaction_id UUID,
  p_document_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Update transaction
  UPDATE categorized_transactions
  SET 
    reconciliation_status = 'matched',
    matched_document_id = p_document_id,
    reconciled_at = NOW(),
    reconciled_by = v_user_id
  WHERE id = p_transaction_id;
  
  -- Update document
  UPDATE documents
  SET 
    reconciliation_status = 'matched',
    matched_transaction_id = p_transaction_id,
    reconciled_at = NOW(),
    reconciled_by = v_user_id
  WHERE id = p_document_id;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unmatch transaction
CREATE OR REPLACE FUNCTION unmatch_transaction(
  p_transaction_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_document_id UUID;
BEGIN
  -- Get the matched document
  SELECT matched_document_id INTO v_document_id
  FROM categorized_transactions
  WHERE id = p_transaction_id;
  
  -- Update transaction
  UPDATE categorized_transactions
  SET 
    reconciliation_status = 'unreconciled',
    matched_document_id = NULL,
    reconciled_at = NULL,
    reconciled_by = NULL
  WHERE id = p_transaction_id;
  
  -- Update document if it exists
  IF v_document_id IS NOT NULL THEN
    UPDATE documents
    SET 
      reconciliation_status = 'unreconciled',
      matched_transaction_id = NULL,
      reconciled_at = NULL,
      reconciled_by = NULL
    WHERE id = v_document_id;
  END IF;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION match_transaction_with_document(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unmatch_transaction(UUID) TO authenticated;

