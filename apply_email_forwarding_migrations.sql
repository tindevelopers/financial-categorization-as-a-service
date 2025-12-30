-- Script to apply email forwarding migrations
-- Run this in Supabase Studio SQL Editor or via psql

-- Migration 1: Add tenant support to email forwarding
-- Migration: Add Tenant Support to Email Forwarding
-- Description: Add tenant_id to email forwarding addresses for tenant-specific email addresses
-- Created: 2025-01-01

-- Add tenant_id column to email_forwarding_addresses
ALTER TABLE email_forwarding_addresses
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Add tenant_id column to email_receipts
ALTER TABLE email_receipts
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Add Gmail watch fields to email_forwarding_addresses
ALTER TABLE email_forwarding_addresses
  ADD COLUMN IF NOT EXISTS gmail_history_id TEXT,
  ADD COLUMN IF NOT EXISTS gmail_watch_expiration TIMESTAMP WITH TIME ZONE;

-- Populate tenant_id from user_id for existing records
UPDATE email_forwarding_addresses efa
SET tenant_id = u.tenant_id
FROM users u
WHERE efa.user_id = u.id AND efa.tenant_id IS NULL;

UPDATE email_receipts er
SET tenant_id = u.tenant_id
FROM users u
WHERE er.user_id = u.id AND er.tenant_id IS NULL;

-- Create index on tenant_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_forwarding_addresses_tenant_id 
  ON email_forwarding_addresses(tenant_id);

CREATE INDEX IF NOT EXISTS idx_email_receipts_tenant_id 
  ON email_receipts(tenant_id);

-- Create index on user_id for per-user lookups (critical for expense tracking)
CREATE INDEX IF NOT EXISTS idx_email_forwarding_addresses_user_id 
  ON email_forwarding_addresses(user_id);

-- Update unique constraint to be per-user (allows each user to have their own unique address)
-- First drop the existing unique constraint if it exists
ALTER TABLE email_forwarding_addresses
  DROP CONSTRAINT IF EXISTS email_forwarding_addresses_email_address_key;

-- Drop the tenant_email unique index if it exists
DROP INDEX IF EXISTS email_forwarding_addresses_tenant_email_unique;

-- Create new unique constraint on user_id (one address per user)
-- This ensures each user gets their own unique email address for expense tracking
CREATE UNIQUE INDEX IF NOT EXISTS email_forwarding_addresses_user_unique
  ON email_forwarding_addresses(user_id) WHERE is_active = true;

-- Also ensure email_address is unique globally (since each address is unique per user)
CREATE UNIQUE INDEX IF NOT EXISTS email_forwarding_addresses_email_unique
  ON email_forwarding_addresses(email_address);

-- Add comment
COMMENT ON COLUMN email_forwarding_addresses.tenant_id IS 'Tenant that owns this forwarding address. Allows tenant-specific email addresses.';

-- Migration 2: Create Platform Settings Table
-- Migration: Create Platform Settings Table
-- Description: Create platform_settings table for system-wide configuration including email forwarding domain
-- Created: 2025-01-01

-- Create platform_settings table
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on setting_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_platform_settings_key 
  ON platform_settings(setting_key);

-- Create index on setting_value for JSONB queries
CREATE INDEX IF NOT EXISTS idx_platform_settings_value 
  ON platform_settings USING GIN(setting_value);

-- Enable RLS on platform_settings
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Platform admins can view platform settings" ON platform_settings;
DROP POLICY IF EXISTS "Platform admins can manage platform settings" ON platform_settings;
DROP POLICY IF EXISTS "All authenticated users can read platform settings" ON platform_settings;

-- Policy: Platform admins can view platform settings
CREATE POLICY "Platform admins can view platform settings"
  ON platform_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = 'Platform Admin'
    )
  );

-- Policy: Platform admins can manage platform settings
CREATE POLICY "Platform admins can manage platform settings"
  ON platform_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = 'Platform Admin'
    )
  );

-- Policy: All authenticated users can read platform settings (for reading email domain)
CREATE POLICY "All authenticated users can read platform settings"
  ON platform_settings
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_platform_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS platform_settings_updated_at ON platform_settings;
CREATE TRIGGER platform_settings_updated_at
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_settings_updated_at();

-- Add comments
COMMENT ON TABLE platform_settings IS 'System-wide platform configuration settings';
COMMENT ON COLUMN platform_settings.setting_key IS 'Unique key identifier for the setting (e.g., email_forwarding_domain)';
COMMENT ON COLUMN platform_settings.setting_value IS 'JSONB value for the setting, allows flexible data types';
COMMENT ON COLUMN platform_settings.description IS 'Human-readable description of what this setting controls';

-- Migration 3: Populate Platform Settings
-- Migration: Populate Platform Settings
-- Description: Populate platform_settings table with default email forwarding domain from environment
-- Created: 2025-01-01

-- Insert default email forwarding domain setting
-- Note: In production, this should be set via the admin UI, but we provide a default
INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES (
  'email_forwarding_domain',
  '{"value": "receipts.fincat.co.uk"}'::jsonb,
  'Email forwarding domain for tenant-specific email addresses. Format: receipts-{user-id}@{domain}'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Add comment
COMMENT ON TABLE platform_settings IS 'System-wide platform configuration settings. Managed by platform administrators.';

-- Verify migrations were applied
SELECT 'Migrations applied successfully!' as status;
SELECT COUNT(*) as platform_settings_count FROM platform_settings;
SELECT COUNT(*) as email_addresses_with_tenant FROM email_forwarding_addresses WHERE tenant_id IS NOT NULL;

