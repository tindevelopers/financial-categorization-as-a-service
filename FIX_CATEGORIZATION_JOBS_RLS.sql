-- ============================================================================
-- FIX: Categorization Jobs RLS and Schema Issues
-- ============================================================================
-- Run this in Supabase SQL Editor to fix:
-- 1. RLS policy violations when inserting categorization_jobs
-- 2. Missing filename column errors (ensure original_filename exists)
-- 3. Ensure all RLS policies are correctly configured
-- ============================================================================

-- Step 1: Ensure original_filename column exists (it should, but verify)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categorization_jobs' 
        AND column_name = 'original_filename'
    ) THEN
        ALTER TABLE categorization_jobs 
        ADD COLUMN original_filename TEXT;
        
        RAISE NOTICE 'Added original_filename column to categorization_jobs table';
    ELSE
        RAISE NOTICE 'original_filename column already exists';
    END IF;
END $$;

-- Step 2: Drop existing RLS policies and recreate them to ensure they're correct
-- This fixes any potential issues with policy definitions

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own categorization jobs" ON categorization_jobs;
DROP POLICY IF EXISTS "Users can create their own categorization jobs" ON categorization_jobs;
DROP POLICY IF EXISTS "Users can update their own categorization jobs" ON categorization_jobs;
DROP POLICY IF EXISTS "Users can delete their own categorization jobs" ON categorization_jobs;

-- Recreate SELECT policy
CREATE POLICY "Users can view their own categorization jobs"
  ON categorization_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- Recreate INSERT policy with explicit check
-- This ensures authenticated users can insert jobs with their own user_id
-- Note: auth.uid() must match user_id exactly for the insert to succeed
-- Using a simpler check that should work with server-side clients
CREATE POLICY "Users can create their own categorization jobs"
  ON categorization_jobs FOR INSERT
  WITH CHECK (
    -- Ensure the user_id in the row matches the authenticated user
    -- This works for both client-side and server-side authenticated requests
    auth.uid() = user_id
  );

-- Recreate UPDATE policy
CREATE POLICY "Users can update their own categorization jobs"
  ON categorization_jobs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Optional: Add DELETE policy if needed
CREATE POLICY "Users can delete their own categorization jobs"
  ON categorization_jobs FOR DELETE
  USING (auth.uid() = user_id);

-- Step 3: Ensure RLS is enabled
ALTER TABLE categorization_jobs ENABLE ROW LEVEL SECURITY;

-- Step 4: Verify the setup
DO $$
DECLARE
    policy_count INTEGER;
    rls_enabled BOOLEAN;
BEGIN
    -- Check RLS is enabled
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = 'categorization_jobs';
    
    -- Count policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'categorization_jobs';
    
    RAISE NOTICE 'RLS enabled: %', rls_enabled;
    RAISE NOTICE 'Number of policies: %', policy_count;
    
    IF NOT rls_enabled THEN
        RAISE WARNING 'RLS is not enabled on categorization_jobs table!';
    END IF;
    
    IF policy_count < 3 THEN
        RAISE WARNING 'Expected at least 3 policies, found %', policy_count;
    END IF;
END $$;

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify the fix worked:
/*
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'categorization_jobs'
ORDER BY policyname;
*/

-- Expected output should show:
-- - Users can view their own categorization jobs (SELECT)
-- - Users can create their own categorization jobs (INSERT)
-- - Users can update their own categorization jobs (UPDATE)
-- - Users can delete their own categorization jobs (DELETE)

