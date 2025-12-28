-- Migration: Ensure invoice fields exist in categorized_transactions
-- Description: This migration ensures the invoice fields are created even if previous migration was marked as applied but didn't execute
-- Created: 2025-12-31

-- Add invoice_number to transactions (safe to run multiple times)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categorized_transactions' 
        AND column_name = 'invoice_number'
    ) THEN
        ALTER TABLE categorized_transactions
            ADD COLUMN invoice_number TEXT;
    END IF;
END $$;

-- Add supplier_id to transactions (safe to run multiple times)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categorized_transactions' 
        AND column_name = 'supplier_id'
    ) THEN
        ALTER TABLE categorized_transactions
            ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add document_id to transactions (safe to run multiple times)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categorized_transactions' 
        AND column_name = 'document_id'
    ) THEN
        ALTER TABLE categorized_transactions
            ADD COLUMN document_id UUID REFERENCES financial_documents(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add indexes for better query performance (safe to run multiple times)
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

