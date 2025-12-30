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

