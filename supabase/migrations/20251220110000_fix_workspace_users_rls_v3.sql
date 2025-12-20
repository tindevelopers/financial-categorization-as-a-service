-- Fix infinite recursion in workspace_users table RLS policies (v3)
-- The v2 migration still had recursion in the "Workspace admins can manage" policy
-- This version removes all self-referencing queries

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

-- Create a function to check if user is admin in a workspace (without recursion)
CREATE OR REPLACE FUNCTION public.is_workspace_admin_for(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_users wu
    JOIN roles r ON wu.role_id = r.id
    WHERE wu.user_id = auth.uid()
    AND wu.workspace_id = ws_id
    AND r.name IN ('Platform Admin', 'Workspace Admin', 'Organization Admin')
  )
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_workspace_admin_for(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin_for(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin_for(UUID) TO service_role;

-- Recreate policies without ANY recursion

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
-- Uses security definer functions to avoid recursion completely
CREATE POLICY "Workspace admins can manage workspace users"
  ON workspace_users FOR ALL
  USING (
    public.is_workspace_admin_for(workspace_id)
  )
  WITH CHECK (
    public.is_workspace_admin_for(workspace_id)
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

COMMENT ON FUNCTION public.is_workspace_admin_for(UUID) IS 
  'Security definer function to check if current user is an admin in the given workspace without RLS recursion';

