-- ============================================================================
-- MIGRATIONS TO APPLY: paid_date and shipping_amount
-- Apply this file via Supabase Dashboard > SQL Editor
-- ============================================================================
-- These migrations add paid_date and shipping_amount fields to financial_documents
-- Safe to run multiple times (uses IF NOT EXISTS)

-- Migration 1: Add paid_date to financial_documents
-- Description: Add paid_date field to track when invoice was paid (can be extracted or manually entered)
-- Created: 2025-12-31

-- Add paid_date column
ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS paid_date DATE;

-- Add index for paid_date queries
CREATE INDEX IF NOT EXISTS idx_financial_documents_paid_date 
  ON financial_documents(paid_date) WHERE paid_date IS NOT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN financial_documents.paid_date IS 'Date when the invoice was paid. Can be extracted from invoice document or manually entered by user.';

-- Migration 2: Add shipping_amount to financial_documents
-- Description: Add shipping_amount field to store shipping costs from invoices
-- Created: 2025-12-31

-- Add shipping_amount column
ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS shipping_amount DECIMAL(12,2);

-- Add comment explaining the field
COMMENT ON COLUMN financial_documents.shipping_amount IS 'Shipping or delivery charges from invoice';

-- Verify the columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'financial_documents' 
  AND column_name IN ('paid_date', 'shipping_amount')
ORDER BY column_name;

