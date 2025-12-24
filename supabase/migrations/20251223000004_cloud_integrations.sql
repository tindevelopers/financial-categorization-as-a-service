-- Migration: Cloud Storage Integrations
-- Description: Add tables for cloud storage integrations (Google Drive, Dropbox, Box, OneDrive)
-- Created: 2025-12-23

-- Create cloud storage integrations table
CREATE TABLE IF NOT EXISTS cloud_storage_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Provider details
  provider TEXT NOT NULL CHECK (provider IN ('google_drive', 'dropbox', 'box', 'onedrive')),
  provider_account_id TEXT,  -- Provider's user/account ID
  provider_account_email TEXT,  -- Provider's account email
  
  -- Folder details
  folder_id TEXT NOT NULL,  -- Provider's folder ID
  folder_name TEXT,
  folder_path TEXT,  -- Human-readable path
  
  -- OAuth tokens (encrypted)
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Sync settings
  auto_sync_enabled BOOLEAN DEFAULT true,
  sync_frequency TEXT DEFAULT '15min' CHECK (sync_frequency IN ('realtime', '15min', 'hourly', 'daily', 'manual')),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'failed', 'in_progress', 'pending')),
  last_sync_error TEXT,
  
  -- Statistics
  files_synced INTEGER DEFAULT 0,
  files_failed INTEGER DEFAULT 0,
  bytes_synced BIGINT DEFAULT 0,
  
  -- Webhook (for real-time notifications where supported)
  webhook_id TEXT,  -- Provider's webhook/notification ID
  webhook_url TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_cloud_storage_integrations_user_id 
  ON cloud_storage_integrations(user_id);

-- Create index on provider
CREATE INDEX IF NOT EXISTS idx_cloud_storage_integrations_provider 
  ON cloud_storage_integrations(provider);

-- Create index on is_active
CREATE INDEX IF NOT EXISTS idx_cloud_storage_integrations_active 
  ON cloud_storage_integrations(is_active) WHERE is_active = true;

-- Create index on auto_sync_enabled for sync jobs
CREATE INDEX IF NOT EXISTS idx_cloud_storage_integrations_auto_sync 
  ON cloud_storage_integrations(auto_sync_enabled, is_active) 
  WHERE auto_sync_enabled = true AND is_active = true;

-- Create composite index for sync job scheduling
CREATE INDEX IF NOT EXISTS idx_cloud_storage_integrations_sync_schedule 
  ON cloud_storage_integrations(sync_frequency, last_sync_at) 
  WHERE auto_sync_enabled = true AND is_active = true;

-- Create cloud storage sync logs table
CREATE TABLE IF NOT EXISTS cloud_storage_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES cloud_storage_integrations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Sync details
  sync_type TEXT NOT NULL CHECK (sync_type IN ('manual', 'scheduled', 'webhook', 'initial')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'cancelled')),
  
  -- Results
  files_found INTEGER DEFAULT 0,
  files_processed INTEGER DEFAULT 0,
  files_uploaded INTEGER DEFAULT 0,
  files_skipped INTEGER DEFAULT 0,
  files_failed INTEGER DEFAULT 0,
  bytes_transferred BIGINT DEFAULT 0,
  
  -- Errors
  error_message TEXT,
  error_details JSONB,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,  -- Duration in milliseconds
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on integration_id
CREATE INDEX IF NOT EXISTS idx_cloud_storage_sync_logs_integration_id 
  ON cloud_storage_sync_logs(integration_id);

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_cloud_storage_sync_logs_user_id 
  ON cloud_storage_sync_logs(user_id);

-- Create index on status
CREATE INDEX IF NOT EXISTS idx_cloud_storage_sync_logs_status 
  ON cloud_storage_sync_logs(status);

-- Create index on started_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_cloud_storage_sync_logs_started_at 
  ON cloud_storage_sync_logs(started_at DESC);

-- Create cloud storage file tracking table (to avoid duplicates)
CREATE TABLE IF NOT EXISTS cloud_storage_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES cloud_storage_integrations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Provider file details
  provider_file_id TEXT NOT NULL,  -- Provider's unique file ID
  provider_file_name TEXT NOT NULL,
  provider_file_path TEXT,
  provider_modified_at TIMESTAMP WITH TIME ZONE,
  provider_size_bytes BIGINT,
  provider_hash TEXT,  -- Provider's file hash/etag
  
  -- Our document reference
  financial_document_id UUID REFERENCES financial_documents(id) ON DELETE SET NULL,
  
  -- Sync status
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'failed', 'deleted')),
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_error TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one provider file per integration
  UNIQUE(integration_id, provider_file_id)
);

-- Create index on integration_id
CREATE INDEX IF NOT EXISTS idx_cloud_storage_files_integration_id 
  ON cloud_storage_files(integration_id);

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_cloud_storage_files_user_id 
  ON cloud_storage_files(user_id);

-- Create index on financial_document_id
CREATE INDEX IF NOT EXISTS idx_cloud_storage_files_document_id 
  ON cloud_storage_files(financial_document_id);

-- Create index on provider_file_id for lookups
CREATE INDEX IF NOT EXISTS idx_cloud_storage_files_provider_file_id 
  ON cloud_storage_files(provider_file_id);

-- Create index on sync_status
CREATE INDEX IF NOT EXISTS idx_cloud_storage_files_sync_status 
  ON cloud_storage_files(sync_status);

-- Enable RLS on cloud_storage_integrations
ALTER TABLE cloud_storage_integrations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own cloud integrations" ON cloud_storage_integrations;
DROP POLICY IF EXISTS "Users can create their own cloud integrations" ON cloud_storage_integrations;
DROP POLICY IF EXISTS "Users can update their own cloud integrations" ON cloud_storage_integrations;
DROP POLICY IF EXISTS "Users can delete their own cloud integrations" ON cloud_storage_integrations;

-- Policy: Users can only see their own integrations
CREATE POLICY "Users can view their own cloud integrations"
  ON cloud_storage_integrations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own integrations
CREATE POLICY "Users can create their own cloud integrations"
  ON cloud_storage_integrations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own integrations
CREATE POLICY "Users can update their own cloud integrations"
  ON cloud_storage_integrations
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own integrations
CREATE POLICY "Users can delete their own cloud integrations"
  ON cloud_storage_integrations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Enable RLS on cloud_storage_sync_logs
ALTER TABLE cloud_storage_sync_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own sync logs" ON cloud_storage_sync_logs;
DROP POLICY IF EXISTS "Service role can insert sync logs" ON cloud_storage_sync_logs;
DROP POLICY IF EXISTS "Service role can update sync logs" ON cloud_storage_sync_logs;

-- Policy: Users can only see their own sync logs
CREATE POLICY "Users can view their own sync logs"
  ON cloud_storage_sync_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert sync logs
CREATE POLICY "Service role can insert sync logs"
  ON cloud_storage_sync_logs
  FOR INSERT
  WITH CHECK (true);

-- Policy: Service role can update sync logs
CREATE POLICY "Service role can update sync logs"
  ON cloud_storage_sync_logs
  FOR UPDATE
  USING (true);

-- Enable RLS on cloud_storage_files
ALTER TABLE cloud_storage_files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own cloud files" ON cloud_storage_files;
DROP POLICY IF EXISTS "Service role can manage cloud files" ON cloud_storage_files;

-- Policy: Users can only see their own files
CREATE POLICY "Users can view their own cloud files"
  ON cloud_storage_files
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can manage cloud files
CREATE POLICY "Service role can manage cloud files"
  ON cloud_storage_files
  FOR ALL
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cloud_storage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist (for idempotency)
DROP TRIGGER IF EXISTS cloud_storage_integrations_updated_at ON cloud_storage_integrations;
DROP TRIGGER IF EXISTS cloud_storage_files_updated_at ON cloud_storage_files;
DROP TRIGGER IF EXISTS cloud_storage_sync_logs_calculate_duration ON cloud_storage_sync_logs;

-- Trigger to automatically update updated_at on cloud_storage_integrations
CREATE TRIGGER cloud_storage_integrations_updated_at
  BEFORE UPDATE ON cloud_storage_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_cloud_storage_updated_at();

-- Trigger to automatically update updated_at on cloud_storage_files
CREATE TRIGGER cloud_storage_files_updated_at
  BEFORE UPDATE ON cloud_storage_files
  FOR EACH ROW
  EXECUTE FUNCTION update_cloud_storage_updated_at();

-- Function to calculate sync duration when completed
CREATE OR REPLACE FUNCTION calculate_sync_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('completed', 'failed', 'cancelled') AND OLD.status = 'in_progress' THEN
    NEW.completed_at = NOW();
    NEW.duration_ms = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate duration on cloud_storage_sync_logs
CREATE TRIGGER cloud_storage_sync_logs_calculate_duration
  BEFORE UPDATE ON cloud_storage_sync_logs
  FOR EACH ROW
  EXECUTE FUNCTION calculate_sync_duration();

-- Add comments for documentation
COMMENT ON TABLE cloud_storage_integrations IS 'Stores OAuth connections to cloud storage providers for automatic document sync';
COMMENT ON TABLE cloud_storage_sync_logs IS 'Tracks sync operations and their results';
COMMENT ON TABLE cloud_storage_files IS 'Tracks individual files from cloud storage to prevent duplicate uploads';
COMMENT ON COLUMN cloud_storage_integrations.access_token_encrypted IS 'Encrypted OAuth access token';
COMMENT ON COLUMN cloud_storage_integrations.refresh_token_encrypted IS 'Encrypted OAuth refresh token';
COMMENT ON COLUMN cloud_storage_sync_logs.duration_ms IS 'Sync duration in milliseconds, calculated automatically';
COMMENT ON COLUMN cloud_storage_files.provider_hash IS 'Provider file hash/etag for change detection';

