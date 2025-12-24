-- Migration: Add updated_at column to categorization_jobs
-- This fixes the PostgREST error 42703: column categorization_jobs.updated_at does not exist
-- Created: 2025-12-24

-- Step 1: Add updated_at column to categorization_jobs table
ALTER TABLE categorization_jobs 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Step 2: Create trigger to auto-update the updated_at column on updates
DROP TRIGGER IF EXISTS update_categorization_jobs_updated_at ON categorization_jobs;
CREATE TRIGGER update_categorization_jobs_updated_at
  BEFORE UPDATE ON categorization_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 3: Backfill existing rows with a sensible value
-- Use completed_at if available, then started_at, then created_at, then NOW()
UPDATE categorization_jobs 
SET updated_at = COALESCE(completed_at, started_at, created_at, NOW())
WHERE updated_at IS NULL;

-- Step 4: Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

