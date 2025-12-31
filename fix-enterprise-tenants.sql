-- Fix Enterprise Accounts: Create tenant records for enterprise users
-- Run this in Supabase SQL Editor

-- Step 1: Create tenant for booking@thegreatwesternhotel.com
INSERT INTO tenants (id, name, domain, plan, subscription_type, status, region)
SELECT 
  gen_random_uuid(),
  'The Great Western Hotel',
  'thegreatwesternhotel.com',
  'enterprise',
  'enterprise',
  'active',
  'us-east-1'
WHERE NOT EXISTS (
  SELECT 1 FROM tenants WHERE domain = 'thegreatwesternhotel.com'
)
RETURNING id as new_tenant_id;

-- Update user to link to tenant
UPDATE users
SET tenant_id = (
  SELECT id FROM tenants WHERE domain = 'thegreatwesternhotel.com' LIMIT 1
)
WHERE email = 'booking@thegreatwesternhotel.com'
  AND tenant_id IS NULL;

-- Step 2: Create tenant for systemadmin@tin.info (Platform Admin - might not need tenant)
-- Platform Admins typically don't have tenants, but if you want them to show as an org:
-- Option A: Create a tenant for them
INSERT INTO tenants (id, name, domain, plan, subscription_type, status, region)
SELECT 
  gen_random_uuid(),
  'Tin Info Platform',
  'tin.info',
  'enterprise',
  'enterprise',
  'active',
  'us-east-1'
WHERE NOT EXISTS (
  SELECT 1 FROM tenants WHERE domain = 'tin.info'
)
RETURNING id as new_tenant_id;

-- IMPORTANT:
-- Do NOT assign tenant_id to global admins (Platform/System/Super Admin).
-- The full admin console requires tenant_id IS NULL for those accounts.
-- If you want regular (non-global-admin) users under tin.info, link them explicitly here.
-- Example:
-- UPDATE users
-- SET tenant_id = (SELECT id FROM tenants WHERE domain = 'tin.info' LIMIT 1)
-- WHERE email IN ('someone@tin.info')
--   AND tenant_id IS NULL;

-- Step 3: Verify the results
SELECT 
  t.id,
  t.name,
  t.domain,
  t.plan,
  t.subscription_type,
  t.status,
  COUNT(u.id) as user_count,
  STRING_AGG(u.email, ', ') as user_emails
FROM tenants t
LEFT JOIN users u ON u.tenant_id = t.id
WHERE t.plan = 'enterprise' OR t.subscription_type = 'enterprise'
GROUP BY t.id, t.name, t.domain, t.plan, t.subscription_type, t.status
ORDER BY t.created_at DESC;

-- Summary
SELECT 
  COUNT(*) FILTER (WHERE plan = 'enterprise' OR subscription_type = 'enterprise') as enterprise_tenants,
  COUNT(*) as total_tenants
FROM tenants;

