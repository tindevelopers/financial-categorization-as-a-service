-- Migration: Add receipt job types to categorization_jobs constraint
-- Description: Update job_type constraint to include 'receipt' and 'batch_receipt' for receipt uploads
-- Created: 2025-12-28

-- Drop existing constraint
ALTER TABLE categorization_jobs 
DROP CONSTRAINT IF EXISTS categorization_jobs_job_type_check;

-- Add updated constraint with receipt types
ALTER TABLE categorization_jobs 
ADD CONSTRAINT categorization_jobs_job_type_check 
CHECK (job_type IN ('spreadsheet', 'invoice', 'batch_invoice', 'receipt', 'batch_receipt'));

-- Add comment for documentation
COMMENT ON COLUMN categorization_jobs.job_type IS 'Type of job: spreadsheet, invoice, batch_invoice, receipt, or batch_receipt';

