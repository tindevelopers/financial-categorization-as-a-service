-- ============================================================================
-- STEP 1: Check if companies table exists
-- ============================================================================

-- Run this first to see what we're dealing with:
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'companies';

-- If it returns a row, the table exists. Check its structure:
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'companies' 
ORDER BY ordinal_position;

-- ============================================================================
-- STEP 2: If table exists but has wrong structure, DROP it
-- ============================================================================

-- ONLY run this if Step 1 showed the table exists with wrong columns:
-- DROP TABLE IF EXISTS companies CASCADE;

-- ============================================================================
-- STEP 3: Check if tenants table exists
-- ============================================================================

-- Our companies table references tenants table
SELECT 
  table_name
FROM information_schema.tables 
WHERE table_name = 'tenants';

-- If no result, we need to handle the foreign key differently

-- ============================================================================
-- STEP 4: Check if auth.users exists
-- ============================================================================

-- Our companies table references auth.users
SELECT 
  table_schema,
  table_name
FROM information_schema.tables 
WHERE table_schema = 'auth' 
  AND table_name = 'users';

