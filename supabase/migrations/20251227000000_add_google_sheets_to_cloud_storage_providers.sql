-- Migration: Add google_sheets to cloud_storage_connections provider constraint
-- This allows storing Google Sheets OAuth tokens in the cloud_storage_connections table
-- Created: 2025-12-27

-- Update provider constraint to include google_sheets
ALTER TABLE cloud_storage_connections 
  DROP CONSTRAINT IF EXISTS cloud_storage_connections_provider_check;

ALTER TABLE cloud_storage_connections 
  ADD CONSTRAINT cloud_storage_connections_provider_check 
  CHECK (provider IN ('dropbox', 'google_drive', 'google_sheets'));

-- Add comment to document the change
COMMENT ON COLUMN cloud_storage_connections.provider IS 'Storage provider: dropbox, google_drive, or google_sheets';

