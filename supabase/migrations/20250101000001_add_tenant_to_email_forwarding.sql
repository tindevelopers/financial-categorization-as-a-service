-- Migration: Add Tenant Support to Email Forwarding
-- Description: Add tenant_id to email forwarding addresses for tenant-specific email addresses
-- Created: 2025-01-01

DO $$
BEGIN
  -- Make safe on fresh local setups (tables may not exist depending on migration history).

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'email_forwarding_addresses'
  ) THEN
    -- Add tenant_id + Gmail watch fields
    ALTER TABLE email_forwarding_addresses
      ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS gmail_history_id TEXT,
      ADD COLUMN IF NOT EXISTS gmail_watch_expiration TIMESTAMP WITH TIME ZONE;

    -- Populate tenant_id from user_id for existing records (best-effort)
    UPDATE email_forwarding_addresses efa
    SET tenant_id = u.tenant_id
    FROM users u
    WHERE efa.user_id = u.id AND efa.tenant_id IS NULL;

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_email_forwarding_addresses_tenant_id
      ON email_forwarding_addresses(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_email_forwarding_addresses_user_id
      ON email_forwarding_addresses(user_id);

    -- Uniqueness adjustments
    ALTER TABLE email_forwarding_addresses
      DROP CONSTRAINT IF EXISTS email_forwarding_addresses_email_address_key;
    DROP INDEX IF EXISTS email_forwarding_addresses_tenant_email_unique;
    CREATE UNIQUE INDEX IF NOT EXISTS email_forwarding_addresses_user_unique
      ON email_forwarding_addresses(user_id) WHERE is_active = true;
    CREATE UNIQUE INDEX IF NOT EXISTS email_forwarding_addresses_email_unique
      ON email_forwarding_addresses(email_address);

    COMMENT ON COLUMN email_forwarding_addresses.tenant_id IS 'Tenant that owns this forwarding address. Allows tenant-specific email addresses.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'email_receipts'
  ) THEN
    ALTER TABLE email_receipts
      ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

    UPDATE email_receipts er
    SET tenant_id = u.tenant_id
    FROM users u
    WHERE er.user_id = u.id AND er.tenant_id IS NULL;

    CREATE INDEX IF NOT EXISTS idx_email_receipts_tenant_id
      ON email_receipts(tenant_id);
  END IF;
END $$;

