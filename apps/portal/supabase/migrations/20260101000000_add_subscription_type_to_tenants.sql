-- Migration: Add subscription_type to tenants table
-- Description: Adds subscription_type field to track Individual, Company, or Enterprise subscriptions
-- Created: 2026-01-01

-- Add subscription_type column to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS subscription_type TEXT 
  CHECK (subscription_type IN ('individual', 'company', 'enterprise'))
  DEFAULT 'individual';

-- Create index for subscription_type queries
CREATE INDEX IF NOT EXISTS idx_tenants_subscription_type ON tenants(subscription_type);

-- Update existing tenants to 'individual' if they don't have a subscription_type
UPDATE tenants
SET subscription_type = 'individual'
WHERE subscription_type IS NULL;

-- Add comment to column
COMMENT ON COLUMN tenants.subscription_type IS 'Subscription type: individual (OAuth only), company (OAuth or BYO credentials), or enterprise (requires BYO credentials)';

