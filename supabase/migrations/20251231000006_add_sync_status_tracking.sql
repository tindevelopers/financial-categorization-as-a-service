-- Migration: Add sync status tracking to categorized_transactions
-- Description: Track synchronization status with Google Sheets for efficient incremental updates
-- Created: 2025-12-31

-- Add sync tracking columns
ALTER TABLE categorized_transactions
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Create index for efficient queries of pending syncs
CREATE INDEX IF NOT EXISTS idx_categorized_transactions_sync_status 
ON categorized_transactions(sync_status) 
WHERE sync_status = 'pending';

-- Create index for job-based sync queries
CREATE INDEX IF NOT EXISTS idx_categorized_transactions_job_sync_status 
ON categorized_transactions(job_id, sync_status) 
WHERE sync_status = 'pending';

-- Add comment
COMMENT ON COLUMN categorized_transactions.last_synced_at IS 'Timestamp when transaction was last synced to Google Sheets';
COMMENT ON COLUMN categorized_transactions.sync_status IS 'Sync status: pending (needs sync), synced (up to date), failed (sync error occurred)';
COMMENT ON COLUMN categorized_transactions.sync_error IS 'Error message if sync failed';


