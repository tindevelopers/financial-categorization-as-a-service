-- Migration: Add OCR metrics fields to financial_documents
-- Description: Store OCR extraction confidence, methods, and validation results for analysis
-- Created: 2025-12-31

-- Add OCR metrics fields to financial_documents table
ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS ocr_field_confidence JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ocr_extraction_methods JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ocr_validation_flags JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ocr_metrics JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ocr_needs_review BOOLEAN DEFAULT FALSE;

-- Add indexes for querying by metrics
CREATE INDEX IF NOT EXISTS idx_financial_documents_ocr_needs_review 
  ON financial_documents(ocr_needs_review) 
  WHERE ocr_needs_review = TRUE;

CREATE INDEX IF NOT EXISTS idx_financial_documents_ocr_confidence 
  ON financial_documents USING GIN ((ocr_field_confidence));

-- Comments for documentation
COMMENT ON COLUMN financial_documents.ocr_field_confidence IS 'Per-field confidence scores from OCR extraction (e.g., {"vendor_name": 0.9, "total": 0.8})';
COMMENT ON COLUMN financial_documents.ocr_extraction_methods IS 'Extraction method used per field (entity, table, pattern, fallback)';
COMMENT ON COLUMN financial_documents.ocr_validation_flags IS 'Validation results per field (true = valid, false = invalid)';
COMMENT ON COLUMN financial_documents.ocr_metrics IS 'Overall extraction metrics including fields_extracted, fields_missing, average_confidence, method_distribution';
COMMENT ON COLUMN financial_documents.ocr_needs_review IS 'Flag indicating if manual review is recommended due to low confidence or validation failures';

