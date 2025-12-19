-- ================================================================
-- Create Developer User: developer@tin.info
-- Password: 88888888
-- ================================================================
-- 
-- IMPORTANT: Run this in Supabase SQL Editor
-- Dashboard → SQL Editor → New Query
--
-- ================================================================

-- Step 1: Check if Platform Admin role exists
DO $$
DECLARE
  admin_role_id UUID;
  admin_user_count INTEGER;
  developer_user_count INTEGER;
BEGIN
  -- Get Platform Admin role ID
  SELECT id INTO admin_role_id 
  FROM public.roles 
  WHERE name = 'Platform Admin' 
  LIMIT 1;
  
  IF admin_role_id IS NULL THEN
    RAISE EXCEPTION 'Platform Admin role not found. Please run migrations first.';
  END IF;
  
  RAISE NOTICE '✓ Platform Admin role found: %', admin_role_id;
  
  -- Check existing users
  SELECT COUNT(*) INTO admin_user_count 
  FROM auth.users 
  WHERE email = 'systemadmin@tin.info';
  
  SELECT COUNT(*) INTO developer_user_count 
  FROM auth.users 
  WHERE email = 'developer@tin.info';
  
  RAISE NOTICE '📊 Existing users:';
  RAISE NOTICE '   - systemadmin@tin.info: % user(s)', admin_user_count;
  RAISE NOTICE '   - developer@tin.info: % user(s)', developer_user_count;
  
END $$;

-- ================================================================
-- Step 2: Instructions for creating users via Supabase Dashboard
-- ================================================================
-- 
-- You CANNOT create auth.users directly via SQL for security reasons.
-- Instead, use the Supabase Dashboard or the admin API.
--
-- METHOD 1: Via Supabase Dashboard (Recommended)
-- ----------------------------------------------
-- 1. Go to: Dashboard → Authentication → Users
-- 2. Click "Add User" button
-- 3. Enter:
--    - Email: systemadmin@tin.info
--    - Password: 88888888
--    - Auto Confirm User: ✓ (checked)
-- 4. Click "Create User"
-- 5. Copy the User ID (UUID)
-- 6. Repeat for developer@tin.info
--
-- METHOD 2: Via Management API (this script will handle it)
-- ---------------------------------------------------------
-- After creating users in Dashboard, run this to create public.users records:

-- ================================================================
-- Step 3: Create public.users records (run AFTER creating auth users)
-- ================================================================

-- For systemadmin@tin.info
-- Replace 'AUTH_USER_UUID_HERE' with actual UUID from auth.users
/*
INSERT INTO public.users (
  id,
  email,
  full_name,
  role_id,
  tenant_id,
  plan,
  status
)
SELECT 
  'AUTH_USER_UUID_HERE'::UUID,  -- Replace with actual auth user UUID
  'systemadmin@tin.info',
  'System Administrator',
  (SELECT id FROM public.roles WHERE name = 'Platform Admin' LIMIT 1),
  NULL,  -- Platform Admins have NULL tenant_id
  'enterprise',
  'active'
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role_id = EXCLUDED.role_id,
  tenant_id = NULL,
  status = 'active';
*/

-- For developer@tin.info
-- Replace 'AUTH_USER_UUID_HERE' with actual UUID from auth.users
/*
INSERT INTO public.users (
  id,
  email,
  full_name,
  role_id,
  tenant_id,
  plan,
  status
)
SELECT 
  'AUTH_USER_UUID_HERE'::UUID,  -- Replace with actual auth user UUID
  'developer@tin.info',
  'Developer User',
  (SELECT id FROM public.roles WHERE name = 'Platform Admin' LIMIT 1),
  NULL,  -- Platform Admins have NULL tenant_id
  'enterprise',
  'active'
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role_id = EXCLUDED.role_id,
  tenant_id = NULL,
  status = 'active';
*/

-- ================================================================
-- Step 4: Verify users were created
-- ================================================================
SELECT 
  u.id,
  u.email,
  u.full_name,
  r.name as role_name,
  r.coverage,
  u.tenant_id,
  u.status
FROM public.users u
LEFT JOIN public.roles r ON u.role_id = r.id
WHERE u.email IN ('systemadmin@tin.info', 'developer@tin.info')
ORDER BY u.email;

-- ================================================================
-- QUICK REFERENCE
-- ================================================================
-- To reset password for existing user via SQL:
-- (This requires the auth.users UUID)
/*
-- Get user UUID first
SELECT id, email FROM auth.users WHERE email = 'systemadmin@tin.info';

-- Then update password (requires service_role or admin privileges)
-- This is better done via Dashboard → Authentication → Users → Edit User
*/


