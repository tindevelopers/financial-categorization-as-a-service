-- Fix infinite recursion in workspace_users table RLS policies
-- The issue: The policy queries workspace_users table from within workspace_users policies
-- causing infinite recursion and 500 errors

-- Create a security definer function to get current user's workspace IDs without RLS
CREATE OR REPLACE FUNCTION public.get_current_user_workspace_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(workspace_id), ARRAY[]::UUID[])
  FROM workspace_users
  WHERE user_id = auth.uid();
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_current_user_workspace_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_workspace_ids() TO anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_workspace_ids() TO service_role;

-- Drop the problematic policies on workspace_users
DROP POLICY IF EXISTS "Users can view workspace users for their workspaces" ON workspace_users;
DROP POLICY IF EXISTS "Platform admins can view all workspace users" ON workspace_users;
DROP POLICY IF EXISTS "Platform admins can manage workspace users" ON workspace_users;
DROP POLICY IF EXISTS "Tenant admins can manage workspace users" ON workspace_users;

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

-- Add comment for documentation
COMMENT ON FUNCTION public.get_current_user_workspace_ids() IS 
  'Security definer function to get current user workspace IDs without RLS recursion';

