-- Migration: Add duplicate detection fields to categorization_jobs
-- Created: 2025-12-25
-- Description: Adds fields for tracking duplicate files and transactions

-- Add normalized_filename column for pattern matching
ALTER TABLE categorization_jobs
ADD COLUMN IF NOT EXISTS normalized_filename TEXT;

-- Add extracted date range columns for filename-based duplicate detection
ALTER TABLE categorization_jobs
ADD COLUMN IF NOT EXISTS extracted_date_start DATE;
ALTER TABLE categorization_jobs
ADD COLUMN IF NOT EXISTS extracted_date_end DATE;

-- Add duplicate_group_id to link duplicate files together
ALTER TABLE categorization_jobs
ADD COLUMN IF NOT EXISTS duplicate_group_id UUID;

-- Add is_duplicate flag
ALTER TABLE categorization_jobs
ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE;

-- Add indexes for efficient duplicate queries
CREATE INDEX IF NOT EXISTS idx_categorization_jobs_normalized_filename 
ON categorization_jobs(normalized_filename) 
WHERE normalized_filename IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categorization_jobs_date_range 
ON categorization_jobs(extracted_date_start, extracted_date_end) 
WHERE extracted_date_start IS NOT NULL AND extracted_date_end IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categorization_jobs_duplicate_group 
ON categorization_jobs(duplicate_group_id) 
WHERE duplicate_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categorization_jobs_is_duplicate 
ON categorization_jobs(is_duplicate) 
WHERE is_duplicate = TRUE;

-- Add comments
COMMENT ON COLUMN categorization_jobs.normalized_filename IS 'Normalized filename pattern for duplicate detection (e.g., "Transaction List YYYY-MM-DD to YYYY-MM-DD.csv")';
COMMENT ON COLUMN categorization_jobs.extracted_date_start IS 'Start date extracted from filename for duplicate detection';
COMMENT ON COLUMN categorization_jobs.extracted_date_end IS 'End date extracted from filename for duplicate detection';
COMMENT ON COLUMN categorization_jobs.duplicate_group_id IS 'UUID linking files that are duplicates of each other';
COMMENT ON COLUMN categorization_jobs.is_duplicate IS 'Flag indicating if this job is a duplicate of another job';

