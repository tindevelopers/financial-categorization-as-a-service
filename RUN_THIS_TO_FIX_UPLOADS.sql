-- ============================================================================
-- FIX UPLOADS: Add job_id column to financial_documents table
-- ============================================================================
-- Run this in your Supabase SQL Editor to fix the 400 error when viewing uploads.
--
-- Problem: The uploads page queries financial_documents for job_id, but that
--          column doesn't exist, causing a 400 error.
--
-- Solution: Add the job_id column to link documents to their categorization jobs.
-- ============================================================================

-- Add job_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'financial_documents' 
        AND column_name = 'job_id'
    ) THEN
        ALTER TABLE financial_documents 
        ADD COLUMN job_id UUID REFERENCES categorization_jobs(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Added job_id column to financial_documents table';
    ELSE
        RAISE NOTICE 'job_id column already exists in financial_documents table';
    END IF;
END $$;

-- Create index for efficient lookups by job_id
CREATE INDEX IF NOT EXISTS idx_financial_documents_job_id 
ON financial_documents(job_id);

-- Add comment explaining the column
COMMENT ON COLUMN financial_documents.job_id IS 
'Links document to its categorization job for tracking upload history and storage info';

-- ============================================================================
-- OPTIONAL: Backfill job_id for existing documents
-- ============================================================================
-- This attempts to match existing financial_documents to categorization_jobs
-- based on filename and user_id. Run this if you have existing data.

UPDATE financial_documents fd
SET job_id = cj.id
FROM categorization_jobs cj
WHERE fd.job_id IS NULL
  AND fd.user_id = cj.user_id
  AND fd.original_filename = cj.original_filename
  AND fd.created_at >= cj.created_at - INTERVAL '1 minute'
  AND fd.created_at <= cj.created_at + INTERVAL '1 minute';

-- Show how many documents were updated
DO $$
DECLARE
    updated_count INTEGER;
    total_docs INTEGER;
    docs_with_job INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_docs FROM financial_documents;
    SELECT COUNT(*) INTO docs_with_job FROM financial_documents WHERE job_id IS NOT NULL;
    
    RAISE NOTICE 'Total financial documents: %', total_docs;
    RAISE NOTICE 'Documents linked to jobs: %', docs_with_job;
END $$;

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify the fix worked:
/*
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'financial_documents' 
  AND column_name = 'job_id';
*/

-- Expected output:
-- column_name | data_type | is_nullable
-- ------------+-----------+-------------
-- job_id      | uuid      | YES

