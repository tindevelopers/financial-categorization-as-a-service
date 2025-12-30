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

