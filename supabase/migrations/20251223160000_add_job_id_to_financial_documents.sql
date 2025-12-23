-- Migration: Add job_id column to financial_documents table
-- Purpose: Link financial documents to categorization jobs for proper tracking and upload history
-- Created: 2025-12-23

-- Add job_id column to financial_documents table
ALTER TABLE financial_documents 
ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES categorization_jobs(id) ON DELETE SET NULL;

-- Create index for efficient lookups by job_id
CREATE INDEX IF NOT EXISTS idx_financial_documents_job_id ON financial_documents(job_id);

-- Comment on the new column
COMMENT ON COLUMN financial_documents.job_id IS 'Links document to its categorization job for tracking upload history and storage info';

