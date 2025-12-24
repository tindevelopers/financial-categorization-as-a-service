-- Migration: Wasabi Archive Setup
-- Description: Add Wasabi S3 archive fields to financial_documents and create lifecycle tracking table
-- Created: 2025-12-23

-- Add Wasabi archive fields to financial_documents
ALTER TABLE financial_documents
  ADD COLUMN IF NOT EXISTS wasabi_archive_path TEXT,
  ADD COLUMN IF NOT EXISTS archived_to_wasabi_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS restore_from_wasabi_requested_at TIMESTAMP WITH TIME ZONE;

-- Update storage_tier check constraint to include wasabi_archive
ALTER TABLE financial_documents 
  DROP CONSTRAINT IF EXISTS financial_documents_storage_tier_check;

ALTER TABLE financial_documents 
  ADD CONSTRAINT financial_documents_storage_tier_check 
    CHECK (storage_tier IN ('hot', 'archive', 'restoring', 'wasabi_archive'));

-- Create archive lifecycle tracking table
CREATE TABLE IF NOT EXISTS storage_lifecycle_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES financial_documents(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('upload', 'archive_to_wasabi', 'restore_from_wasabi', 'delete')),
  from_tier TEXT,
  to_tier TEXT,
  bytes_moved BIGINT,
  cost_estimate DECIMAL(10,4),  -- Estimated cost in USD
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on document_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_storage_lifecycle_logs_document_id 
  ON storage_lifecycle_logs(document_id);

-- Create index on action for reporting
CREATE INDEX IF NOT EXISTS idx_storage_lifecycle_logs_action 
  ON storage_lifecycle_logs(action);

-- Create index on completed_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_storage_lifecycle_logs_completed_at 
  ON storage_lifecycle_logs(completed_at DESC);

-- Add comment for documentation
COMMENT ON TABLE storage_lifecycle_logs IS 'Tracks lifecycle events for documents as they move between storage tiers (Supabase hot storage, Wasabi S3 archive, etc.)';
COMMENT ON COLUMN storage_lifecycle_logs.cost_estimate IS 'Estimated cost in USD for this storage operation';
COMMENT ON COLUMN storage_lifecycle_logs.bytes_moved IS 'Number of bytes transferred during this operation';

