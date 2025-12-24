-- Migration: Add tenant_type column and Individual Admin role
-- Description: Adds tenant_type to distinguish individual vs company tenants, and creates Individual Admin role

-- ============================================================================
-- 1. Add tenant_type column to tenants table
-- ============================================================================

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS tenant_type TEXT DEFAULT 'company' 
CHECK (tenant_type IN ('individual', 'company'));

-- Set default for existing tenants
UPDATE tenants 
SET tenant_type = 'company' 
WHERE tenant_type IS NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_tenants_tenant_type ON tenants(tenant_type);

-- Add comment explaining the column
COMMENT ON COLUMN tenants.tenant_type IS 'Type of tenant: individual (personal account) or company (organization account)';

-- ============================================================================
-- 2. Create Individual Admin role
-- ============================================================================

-- Insert Individual Admin role if it doesn't exist
INSERT INTO roles (name, description, coverage, max_seats, current_seats, permissions, gradient)
VALUES (
  'Individual Admin',
  'Full admin access for individual users: manage their own account, invite collaborators, and configure personal settings.',
  'Per tenant',
  1000,
  0,
  ARRAY['Workspace settings', 'User management', 'Billing', 'Branding', 'API access'],
  'from-violet-500 to-purple-500'
)
ON CONFLICT (name) DO NOTHING;

