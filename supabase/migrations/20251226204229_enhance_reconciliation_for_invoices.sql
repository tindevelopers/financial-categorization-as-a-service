-- Migration: Enhance Reconciliation for Invoices
-- Description: Add unreconciled items view and enhance reconciliation tracking
-- Created: 2025-12-26

-- Create view for unreconciled items (invoices and transactions)
CREATE OR REPLACE VIEW unreconciled_items AS
SELECT 
  'invoice' as item_type,
  fd.id,
  fd.vendor_name as description,
  fd.total_amount as amount,
  fd.document_date as date,
  fd.reconciliation_status,
  fd.matched_transaction_id as matched_id,
  fd.original_filename,
  fd.document_number as invoice_number,
  fd.currency,
  fd.created_at,
  NULL::UUID as job_id,
  NULL::TEXT as source_type
FROM financial_documents fd
WHERE fd.file_type = 'invoice'
  AND fd.reconciliation_status = 'unreconciled'
  AND fd.matched_transaction_id IS NULL
UNION ALL
SELECT 
  'transaction' as item_type,
  ct.id,
  ct.original_description as description,
  ct.amount,
  ct.date,
  ct.reconciliation_status,
  ct.matched_document_id as matched_id,
  NULL::TEXT as original_filename,
  NULL::TEXT as invoice_number,
  NULL::TEXT as currency,
  ct.created_at,
  ct.job_id,
  ct.source_type
FROM categorized_transactions ct
WHERE ct.reconciliation_status = 'unreconciled'
  AND ct.matched_document_id IS NULL;

-- Grant access to the view
GRANT SELECT ON unreconciled_items TO authenticated;

-- Create index for better performance on reconciliation queries
CREATE INDEX IF NOT EXISTS idx_financial_documents_invoice_unreconciled 
  ON financial_documents(file_type, reconciliation_status, matched_transaction_id) 
  WHERE file_type = 'invoice' AND reconciliation_status = 'unreconciled';

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_unreconciled_no_match 
  ON categorized_transactions(reconciliation_status, matched_document_id) 
  WHERE reconciliation_status = 'unreconciled' AND matched_document_id IS NULL;

-- Add comment for documentation
COMMENT ON VIEW unreconciled_items IS 'View showing unreconciled invoices and transactions that need matching';

