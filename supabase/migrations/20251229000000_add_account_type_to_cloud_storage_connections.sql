-- Migration: Add Account Type and Workspace Domain to Cloud Storage Connections
-- Phase 3: Google Workspace Admin Account Integration
-- Created: 2025-12-29
-- Description: Add columns to support Google Workspace admin accounts and account type tracking

-- Add account_type column (personal or workspace_admin)
ALTER TABLE cloud_storage_connections
ADD COLUMN IF NOT EXISTS account_type TEXT CHECK (account_type IN ('personal', 'workspace_admin')) DEFAULT 'personal';

-- Add workspace_domain column for Google Workspace accounts
ALTER TABLE cloud_storage_connections
ADD COLUMN IF NOT EXISTS workspace_domain TEXT;

-- Add is_workspace_admin boolean flag for quick filtering
ALTER TABLE cloud_storage_connections
ADD COLUMN IF NOT EXISTS is_workspace_admin BOOLEAN DEFAULT FALSE;

-- Create index for workspace domain lookups
CREATE INDEX IF NOT EXISTS idx_cloud_storage_connections_workspace_domain 
  ON cloud_storage_connections(workspace_domain) 
  WHERE workspace_domain IS NOT NULL;

-- Create index for account type filtering
CREATE INDEX IF NOT EXISTS idx_cloud_storage_connections_account_type 
  ON cloud_storage_connections(account_type);

-- Create index for workspace admin filtering
CREATE INDEX IF NOT EXISTS idx_cloud_storage_connections_is_workspace_admin 
  ON cloud_storage_connections(is_workspace_admin) 
  WHERE is_workspace_admin = TRUE;

-- Update existing google_sheets connections to detect workspace accounts based on email domain
-- This is a one-time migration for existing data
UPDATE cloud_storage_connections csc
SET 
  is_workspace_admin = CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_integrations ui 
      WHERE ui.user_id = csc.user_id 
      AND ui.provider = 'google_sheets'
      AND ui.provider_email IS NOT NULL
      AND ui.provider_email NOT LIKE '%@gmail.com'
      AND ui.provider_email NOT LIKE '%@googlemail.com'
    ) THEN TRUE
    ELSE FALSE
  END,
  workspace_domain = CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_integrations ui 
      WHERE ui.user_id = csc.user_id 
      AND ui.provider = 'google_sheets'
      AND ui.provider_email IS NOT NULL
      AND ui.provider_email NOT LIKE '%@gmail.com'
      AND ui.provider_email NOT LIKE '%@googlemail.com'
    ) THEN (
      SELECT SPLIT_PART(ui.provider_email, '@', 2)
      FROM user_integrations ui
      WHERE ui.user_id = csc.user_id 
      AND ui.provider = 'google_sheets'
      LIMIT 1
    )
    ELSE NULL
  END
WHERE csc.provider = 'google_sheets'
AND csc.is_workspace_admin IS FALSE;

-- Add comment to document the columns
COMMENT ON COLUMN cloud_storage_connections.account_type IS 'Type of account: personal (standard Google account) or workspace_admin (Google Workspace admin account)';
COMMENT ON COLUMN cloud_storage_connections.workspace_domain IS 'Google Workspace domain for workspace_admin accounts (e.g., example.com)';
COMMENT ON COLUMN cloud_storage_connections.is_workspace_admin IS 'Quick flag to identify Google Workspace admin accounts';

