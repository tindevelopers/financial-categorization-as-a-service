-- Migration: Enhance Reconciliation for Bank Account Context
-- Description: Update reconciliation functions to consider bank_account_id
-- Created: 2025-12-26

-- ============================================================================
-- ADD RECONCILIATION CONFIDENCE SCORE TO TRANSACTIONS
-- ============================================================================

ALTER TABLE categorized_transactions
ADD COLUMN IF NOT EXISTS reconciliation_confidence_score DECIMAL(5,2) CHECK (
  reconciliation_confidence_score IS NULL OR 
  (reconciliation_confidence_score >= 0 AND reconciliation_confidence_score <= 100)
);

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_reconciliation_confidence 
  ON categorized_transactions(reconciliation_confidence_score);

-- ============================================================================
-- UPDATE MATCH TRANSACTION WITH DOCUMENT FUNCTION
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS match_transaction_with_document(UUID, UUID);

-- Create enhanced function that considers bank_account_id
CREATE OR REPLACE FUNCTION match_transaction_with_document(
  p_transaction_id UUID,
  p_document_id UUID,
  p_bank_account_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_bank_account_id UUID;
  v_document_bank_account_id UUID;
BEGIN
  -- Get bank account IDs
  SELECT bank_account_id INTO v_transaction_bank_account_id
  FROM categorized_transactions
  WHERE id = p_transaction_id;
  
  SELECT bank_account_id INTO v_document_bank_account_id
  FROM financial_documents
  WHERE id = p_document_id;
  
  -- Update transaction
  UPDATE categorized_transactions
  SET 
    reconciliation_status = 'matched',
    matched_document_id = p_document_id,
    reconciliation_confidence_score = CASE
      WHEN p_bank_account_id IS NOT NULL AND v_transaction_bank_account_id = p_bank_account_id THEN 95.0
      WHEN v_transaction_bank_account_id = v_document_bank_account_id AND v_transaction_bank_account_id IS NOT NULL THEN 90.0
      ELSE 85.0
    END,
    updated_at = NOW()
  WHERE id = p_transaction_id;
  
  -- Update document
  UPDATE financial_documents
  SET 
    matched_transaction_id = p_transaction_id,
    updated_at = NOW()
  WHERE id = p_document_id;
  
  -- Also update documents table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
    UPDATE documents
    SET 
      matched_transaction_id = p_transaction_id,
      reconciliation_status = 'matched',
      updated_at = NOW()
    WHERE id = p_document_id;
  END IF;
END;
$$;

-- ============================================================================
-- CREATE FUNCTION TO FIND MATCHES WITH BANK ACCOUNT CONTEXT
-- ============================================================================

CREATE OR REPLACE FUNCTION find_transaction_matches_for_document(
  p_document_id UUID,
  p_bank_account_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  transaction_id UUID,
  transaction_date DATE,
  transaction_amount DECIMAL(10,2),
  transaction_description TEXT,
  bank_account_id UUID,
  bank_account_name TEXT,
  match_score DECIMAL(5,2),
  amount_diff DECIMAL(10,2),
  date_diff_days INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_document_amount DECIMAL(10,2);
  v_document_date DATE;
  v_document_vendor TEXT;
BEGIN
  -- Get document details
  SELECT 
    total_amount,
    document_date,
    vendor_name
  INTO v_document_amount, v_document_date, v_document_vendor
  FROM financial_documents
  WHERE id = p_document_id;
  
  -- If document table exists, try to get from there too
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
    SELECT 
      COALESCE(v_document_amount, total_amount),
      COALESCE(v_document_date, invoice_date),
      COALESCE(v_document_vendor, vendor_name)
    INTO v_document_amount, v_document_date, v_document_vendor
    FROM documents
    WHERE id = p_document_id
    LIMIT 1;
  END IF;
  
  -- Find matching transactions
  RETURN QUERY
  SELECT 
    ct.id AS transaction_id,
    ct.date AS transaction_date,
    ct.amount AS transaction_amount,
    ct.original_description AS transaction_description,
    ct.bank_account_id,
    ba.account_name AS bank_account_name,
    -- Calculate match score
    (
      -- Amount match (40% weight)
      CASE 
        WHEN ABS(ct.amount - COALESCE(v_document_amount, 0)) < 0.01 THEN 40.0
        WHEN ABS(ct.amount - COALESCE(v_document_amount, 0)) < 1.00 THEN 30.0
        WHEN ABS(ct.amount - COALESCE(v_document_amount, 0)) < 100.00 THEN 20.0
        ELSE 0.0
      END +
      -- Date proximity (30% weight)
      CASE 
        WHEN v_document_date IS NOT NULL AND ABS(EXTRACT(DAY FROM (ct.date - v_document_date))) <= 7 THEN 30.0
        WHEN v_document_date IS NOT NULL AND ABS(EXTRACT(DAY FROM (ct.date - v_document_date))) <= 30 THEN 20.0
        WHEN v_document_date IS NOT NULL AND ABS(EXTRACT(DAY FROM (ct.date - v_document_date))) <= 60 THEN 10.0
        ELSE 0.0
      END +
      -- Vendor name similarity (20% weight)
      CASE 
        WHEN v_document_vendor IS NOT NULL AND ct.original_description ILIKE '%' || v_document_vendor || '%' THEN 20.0
        WHEN v_document_vendor IS NOT NULL AND similarity(ct.original_description, v_document_vendor) > 0.6 THEN 15.0
        ELSE 0.0
      END +
      -- Bank account context (10% weight)
      CASE 
        WHEN p_bank_account_id IS NOT NULL AND ct.bank_account_id = p_bank_account_id THEN 10.0
        ELSE 0.0
      END
    ) AS match_score,
    ABS(ct.amount - COALESCE(v_document_amount, 0)) AS amount_diff,
    CASE 
      WHEN v_document_date IS NOT NULL THEN ABS(EXTRACT(DAY FROM (ct.date - v_document_date)))
      ELSE NULL
    END AS date_diff_days
  FROM categorized_transactions ct
  LEFT JOIN bank_accounts ba ON ct.bank_account_id = ba.id
  INNER JOIN categorization_jobs cj ON ct.job_id = cj.id
  WHERE 
    ct.reconciliation_status = 'unreconciled'
    AND cj.user_id = (SELECT user_id FROM financial_documents WHERE id = p_document_id)
    AND (p_bank_account_id IS NULL OR ct.bank_account_id = p_bank_account_id)
    AND (v_document_amount IS NULL OR ABS(ct.amount - v_document_amount) < 100.00)
  ORDER BY match_score DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION find_transaction_matches_for_document TO authenticated;
GRANT EXECUTE ON FUNCTION match_transaction_with_document TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN categorized_transactions.reconciliation_confidence_score IS 'AI matching confidence score (0-100)';
COMMENT ON FUNCTION find_transaction_matches_for_document IS 'Find best transaction matches for a document with bank account context';
COMMENT ON FUNCTION match_transaction_with_document IS 'Match a transaction with a document, considering bank account context';

