-- Migration: Add supplier_id to financial_documents
-- Links documents to suppliers table
-- Created: 2025-12-28

-- Add supplier_id column
ALTER TABLE financial_documents
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- Add index for supplier lookups
CREATE INDEX IF NOT EXISTS idx_financial_documents_supplier_id 
  ON financial_documents(supplier_id);

-- Add order_number column for order confirmations
ALTER TABLE financial_documents
ADD COLUMN IF NOT EXISTS order_number TEXT;

-- Add delivery_date column
ALTER TABLE financial_documents
ADD COLUMN IF NOT EXISTS delivery_date DATE;

-- Add index for order number searches
CREATE INDEX IF NOT EXISTS idx_financial_documents_order_number 
  ON financial_documents(order_number);

-- Comments
COMMENT ON COLUMN financial_documents.supplier_id IS 'Reference to suppliers table';
COMMENT ON COLUMN financial_documents.order_number IS 'Order number or PO number from invoice';
COMMENT ON COLUMN financial_documents.delivery_date IS 'Delivery date for orders';

