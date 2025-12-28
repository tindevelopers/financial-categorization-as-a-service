-- Migration: Add invoice fields to categorized_transactions
-- Description: Link transactions to invoices and suppliers for better tracking
-- Created: 2025-12-31

-- Add invoice_number to transactions
ALTER TABLE categorized_transactions
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Add supplier_id to transactions (references suppliers table)
ALTER TABLE categorized_transactions
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- Add document_id to transactions (references financial_documents table)
ALTER TABLE categorized_transactions
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES financial_documents(id) ON DELETE SET NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_categorized_transactions_invoice_number 
  ON categorized_transactions(invoice_number);

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_supplier_id 
  ON categorized_transactions(supplier_id);

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_document_id 
  ON categorized_transactions(document_id);

-- Comments for documentation
COMMENT ON COLUMN categorized_transactions.invoice_number IS 'Invoice number from the source document';
COMMENT ON COLUMN categorized_transactions.supplier_id IS 'Reference to suppliers table';
COMMENT ON COLUMN categorized_transactions.document_id IS 'Reference to financial_documents table';

