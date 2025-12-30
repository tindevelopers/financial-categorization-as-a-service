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

