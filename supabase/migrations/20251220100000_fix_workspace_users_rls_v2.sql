-- Fix infinite recursion in workspace_users table RLS policies (v2)
-- This migration handles cases where some policies may already exist

-- Drop ALL policies on workspace_users first (clean slate)
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'workspace_users'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON workspace_users';
  END LOOP;
END $$;

-- Recreate policies without recursion

-- Policy 1: Users can view their own workspace_users record
CREATE POLICY "Users can view their own workspace membership"
  ON workspace_users FOR SELECT
  USING (user_id = auth.uid());

-- Policy 2: Users can view workspace_users for workspaces they belong to
-- Uses the security definer function to avoid recursion
CREATE POLICY "Users can view workspace users for their workspaces"
  ON workspace_users FOR SELECT
  USING (
    workspace_id = ANY(public.get_current_user_workspace_ids())
  );

-- Policy 3: Platform Admins can view all workspace_users
CREATE POLICY "Platform admins can view all workspace users"
  ON workspace_users FOR SELECT
  USING (is_platform_admin());

-- Policy 4: Platform Admins can manage all workspace_users
CREATE POLICY "Platform admins can manage workspace users"
  ON workspace_users FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Policy 5: Workspace admins can manage workspace users in their workspaces
CREATE POLICY "Workspace admins can manage workspace users"
  ON workspace_users FOR ALL
  USING (
    workspace_id = ANY(public.get_current_user_workspace_ids())
    AND EXISTS (
      SELECT 1 FROM workspace_users wu
      JOIN roles r ON wu.role_id = r.id
      WHERE wu.user_id = auth.uid()
      AND wu.workspace_id = workspace_users.workspace_id
      AND r.name IN ('Platform Admin', 'Workspace Admin', 'Organization Admin')
    )
  )
  WITH CHECK (
    workspace_id = ANY(public.get_current_user_workspace_ids())
  );

-- Verify policies were created
DO $$
DECLARE
  policy_count INT;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'public' AND tablename = 'workspace_users';
  
  RAISE NOTICE 'Created % policies on workspace_users', policy_count;
END $$;

