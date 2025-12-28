-- ============================================================================
-- TRANSACTION BREAKDOWN MIGRATION
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to add transaction breakdown support
-- This migration adds fields for G/L breakdown tracking when receipts are matched
-- ============================================================================

-- Add parent_transaction_id to categorized_transactions for linking breakdown entries
ALTER TABLE categorized_transactions
  ADD COLUMN IF NOT EXISTS parent_transaction_id UUID REFERENCES categorized_transactions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS breakdown_type TEXT CHECK (breakdown_type IN ('subtotal', 'tax', 'fee', 'shipping', 'other', NULL)),
  ADD COLUMN IF NOT EXISTS is_breakdown_entry BOOLEAN DEFAULT FALSE;

-- Create index for querying breakdown entries
CREATE INDEX IF NOT EXISTS idx_categorized_transactions_parent_transaction 
  ON categorized_transactions(parent_transaction_id) 
  WHERE parent_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_breakdown_type 
  ON categorized_transactions(breakdown_type) 
  WHERE breakdown_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_is_breakdown 
  ON categorized_transactions(is_breakdown_entry) 
  WHERE is_breakdown_entry = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN categorized_transactions.parent_transaction_id IS 'Reference to parent transaction when this is a breakdown entry (e.g., tax, fee, shipping)';
COMMENT ON COLUMN categorized_transactions.breakdown_type IS 'Type of breakdown entry: subtotal, tax, fee, shipping, or other';
COMMENT ON COLUMN categorized_transactions.is_breakdown_entry IS 'Flag indicating this transaction is a breakdown entry of a parent transaction';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the migration was successful:

-- Check if columns were added
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'categorized_transactions' 
  AND column_name IN ('parent_transaction_id', 'breakdown_type', 'is_breakdown_entry')
ORDER BY column_name;

-- Check if indexes were created
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'categorized_transactions' 
  AND indexname LIKE '%breakdown%' OR indexname LIKE '%parent_transaction%'
ORDER BY indexname;

-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================
-- The transaction breakdown feature is now enabled.
-- Receipts matched to transactions will automatically create G/L breakdown entries.

