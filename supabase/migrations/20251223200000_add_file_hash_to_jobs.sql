-- Migration: Add file_hash column to categorization_jobs table
-- This allows quick duplicate detection without joining financial_documents
-- Created: 2025-12-23

-- Add file_hash column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categorization_jobs' 
        AND column_name = 'file_hash'
    ) THEN
        ALTER TABLE categorization_jobs 
        ADD COLUMN file_hash TEXT;
        
        RAISE NOTICE 'Added file_hash column to categorization_jobs table';
    ELSE
        RAISE NOTICE 'file_hash column already exists in categorization_jobs table';
    END IF;
END $$;

-- Create index for faster duplicate detection
CREATE INDEX IF NOT EXISTS idx_categorization_jobs_file_hash 
ON categorization_jobs(file_hash) 
WHERE file_hash IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN categorization_jobs.file_hash IS 
'SHA-256 hash of the uploaded file for duplicate detection. NULL if hash not calculated (for backward compatibility).';

