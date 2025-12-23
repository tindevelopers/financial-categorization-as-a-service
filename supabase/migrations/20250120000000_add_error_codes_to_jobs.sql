-- Migration: Add error codes and status messages to categorization_jobs
-- Created: 2025-01-20
-- Purpose: Support structured error codes and user-friendly status messages

-- Add error_code column
ALTER TABLE categorization_jobs 
ADD COLUMN IF NOT EXISTS error_code TEXT;

-- Add status_message column for user-friendly status descriptions
ALTER TABLE categorization_jobs 
ADD COLUMN IF NOT EXISTS status_message TEXT;

-- Update status check constraint to include 'received' status
ALTER TABLE categorization_jobs 
DROP CONSTRAINT IF EXISTS categorization_jobs_status_check;

ALTER TABLE categorization_jobs 
ADD CONSTRAINT categorization_jobs_status_check 
CHECK (status IN ('received', 'uploaded', 'queued', 'pending', 'processing', 'reviewing', 'completed', 'failed'));

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_categorization_jobs_status ON categorization_jobs(status);
CREATE INDEX IF NOT EXISTS idx_categorization_jobs_error_code ON categorization_jobs(error_code);

-- Add comment for documentation
COMMENT ON COLUMN categorization_jobs.error_code IS 'Structured error code for programmatic error handling';
COMMENT ON COLUMN categorization_jobs.status_message IS 'User-friendly status description';

