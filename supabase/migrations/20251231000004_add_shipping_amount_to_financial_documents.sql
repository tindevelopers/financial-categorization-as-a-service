-- Migration: Add shipping_amount to financial_documents
-- Description: Add shipping_amount field to store shipping costs from invoices
-- Created: 2025-12-31

-- Add shipping_amount column
ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS shipping_amount DECIMAL(12,2);

-- Add comment explaining the field
COMMENT ON COLUMN financial_documents.shipping_amount IS 'Shipping or delivery charges from invoice';

