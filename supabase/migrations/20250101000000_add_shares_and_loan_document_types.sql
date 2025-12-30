-- Migration: Add Shares and Loan Document Types
-- Description: Extend file_type to support shares, loan agreements, and capital stock documents
-- Created: 2025-01-01

-- Drop the existing check constraint
ALTER TABLE financial_documents
  DROP CONSTRAINT IF EXISTS financial_documents_file_type_check;

-- Add new check constraint with additional document types
ALTER TABLE financial_documents
  ADD CONSTRAINT financial_documents_file_type_check 
    CHECK (file_type IN (
      'bank_statement', 
      'receipt', 
      'invoice', 
      'tax_document',
      'shares',
      'loan_agreement',
      'capital_stock',
      'other'
    ));

-- Add comment for documentation
COMMENT ON COLUMN financial_documents.file_type IS 'Type of financial document: bank_statement, receipt, invoice, tax_document, shares (share certificates), loan_agreement (loan documents), capital_stock (capital stock documents), or other';

