-- Migration: Add invoice_number and ocr_confidence_score to financial_documents
-- Description: These columns are used by the OCR processing code but were missing from the table
-- Created: 2025-12-29

-- Add invoice_number column (separate from document_number for backwards compatibility)
-- The code uses invoice_number while the original schema has document_number
ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Add ocr_confidence_score column
-- The code uses ocr_confidence_score while the original schema has ocr_confidence
-- Adding both for compatibility
ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS ocr_confidence_score DECIMAL(3,2) 
    CHECK (ocr_confidence_score IS NULL OR (ocr_confidence_score >= 0 AND ocr_confidence_score <= 1));

-- Add index for invoice_number lookups
CREATE INDEX IF NOT EXISTS idx_financial_documents_invoice_number 
  ON financial_documents(invoice_number);

-- Comments for documentation
COMMENT ON COLUMN financial_documents.invoice_number IS 'Invoice number extracted from the document (distinct from document_number for clarity)';
COMMENT ON COLUMN financial_documents.ocr_confidence_score IS 'Overall OCR confidence score (0-1) for the extraction';


