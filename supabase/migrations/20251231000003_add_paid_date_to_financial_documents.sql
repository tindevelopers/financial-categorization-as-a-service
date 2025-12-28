-- Migration: Add paid_date to financial_documents
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

