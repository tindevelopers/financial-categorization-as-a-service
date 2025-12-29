-- Migration: Add Google Shared Drive configuration to company_profiles
-- Purpose: Enable company-level Shared Drive for Google Sheets exports
-- Created: 2025-12-29

-- Add shared drive configuration columns
ALTER TABLE company_profiles 
ADD COLUMN IF NOT EXISTS google_shared_drive_id TEXT,
ADD COLUMN IF NOT EXISTS google_shared_drive_name TEXT,
ADD COLUMN IF NOT EXISTS google_master_spreadsheet_id TEXT,
ADD COLUMN IF NOT EXISTS google_master_spreadsheet_name TEXT;

-- Add comments for documentation
COMMENT ON COLUMN company_profiles.google_shared_drive_id IS 'Google Shared Drive ID for company exports';
COMMENT ON COLUMN company_profiles.google_shared_drive_name IS 'Human-readable name of the Shared Drive';
COMMENT ON COLUMN company_profiles.google_master_spreadsheet_id IS 'Master spreadsheet ID for consolidated bank statements';
COMMENT ON COLUMN company_profiles.google_master_spreadsheet_name IS 'Human-readable name of the master spreadsheet';

