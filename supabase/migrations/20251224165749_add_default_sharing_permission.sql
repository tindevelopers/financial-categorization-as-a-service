-- Migration: Add default_sharing_permission to tenant_integration_settings
-- Description: Allows companies to set default permission level (reader/writer) for auto-shared Google Sheets
-- Created: 2025-12-24

-- Add default_sharing_permission column
ALTER TABLE tenant_integration_settings
ADD COLUMN IF NOT EXISTS default_sharing_permission TEXT DEFAULT 'reader' 
CHECK (default_sharing_permission IN ('reader', 'writer'));

-- Add comment
COMMENT ON COLUMN tenant_integration_settings.default_sharing_permission IS 
  'Default permission level for auto-shared Google Sheets: reader (view only) or writer (can edit)';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_tenant_integration_settings_sharing_permission 
ON tenant_integration_settings(tenant_id, provider, default_sharing_permission)
WHERE default_sharing_permission IS NOT NULL;

