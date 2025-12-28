-- ============================================================================
-- MANUAL MIGRATION: Add invoice fields to categorized_transactions
-- ============================================================================
-- This SQL should be run manually in the Supabase Dashboard SQL Editor
-- if the automatic migration didn't apply correctly.
--
-- Instructions:
-- 1. Go to https://supabase.com/dashboard
-- 2. Select your project: financial-categorization-as-a-service
-- 3. Go to SQL Editor
-- 4. Paste this entire file
-- 5. Click "Run"
-- ============================================================================

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
        RAISE NOTICE 'Added invoice_number column';
    ELSE
        RAISE NOTICE 'invoice_number column already exists';
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
        RAISE NOTICE 'Added supplier_id column';
    ELSE
        RAISE NOTICE 'supplier_id column already exists';
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
        RAISE NOTICE 'Added document_id column';
    ELSE
        RAISE NOTICE 'document_id column already exists';
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

-- Verify columns were created
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'categorized_transactions' 
    AND column_name IN ('invoice_number', 'supplier_id', 'document_id')
ORDER BY column_name;

