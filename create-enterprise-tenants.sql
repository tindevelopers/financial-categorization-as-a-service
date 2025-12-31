-- Create Enterprise Tenants for Users Missing Tenant Records
-- Run this in Supabase SQL Editor

-- 1. Create tenant for The Great Western Hotel
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Create tenant if it doesn't exist
  INSERT INTO tenants (id, name, domain, plan, subscription_type, status, region)
  VALUES (
    gen_random_uuid(),
    'The Great Western Hotel',
    'thegreatwesternhotel.com',
    'enterprise',
    'enterprise',
    'active',
    'us-east-1'
  )
  ON CONFLICT (domain) DO UPDATE SET
    plan = 'enterprise',
    subscription_type = 'enterprise',
    status = 'active'
  RETURNING id INTO v_tenant_id;

  -- Link user to tenant
  UPDATE users
  SET tenant_id = v_tenant_id
  WHERE email = 'booking@thegreatwesternhotel.com'
    AND tenant_id IS NULL;
END $$;

-- 2. Create tenant for Tin Info (for regular enterprise users)
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Create tenant if it doesn't exist
  INSERT INTO tenants (id, name, domain, plan, subscription_type, status, region)
  VALUES (
    gen_random_uuid(),
    'Tin Info Platform',
    'tin.info',
    'enterprise',
    'enterprise',
    'active',
    'us-east-1'
  )
  ON CONFLICT (domain) DO UPDATE SET
    plan = 'enterprise',
    subscription_type = 'enterprise',
    status = 'active'
  RETURNING id INTO v_tenant_id;

  -- IMPORTANT:
  -- Do NOT set tenant_id for system-wide admins (Platform/System/Super Admin),
  -- because the full admin console requires tenant_id IS NULL for global admins.
  -- If you need tenant users on tin.info, add them here explicitly (non-admins only).
  -- Example:
  -- UPDATE users SET tenant_id = v_tenant_id
  -- WHERE email IN ('someone@tin.info')
  --   AND tenant_id IS NULL;
END $$;

-- 3. Verify results
SELECT 
  'Tenants Summary' as report_type,
  COUNT(*) as total_tenants,
  COUNT(*) FILTER (WHERE plan = 'enterprise' OR subscription_type = 'enterprise') as enterprise_tenants
FROM tenants;

-- 4. Show all enterprise tenants with their users
SELECT 
  t.name as organization_name,
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

