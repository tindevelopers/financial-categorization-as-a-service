# Workspace Users RLS Fix Summary

## Problem
The `workspace_users` table RLS policies had infinite recursion issues. Policies were querying the `workspace_users` table from within `workspace_users` policies, causing 500 errors.

## Solution
Created three migration files to progressively fix the recursion issue:

### Migration 1: `20251220000000_fix_workspace_users_rls_recursion.sql`
- **Purpose**: Create a security definer function to get workspace IDs without RLS recursion
- **Key Function**: `get_current_user_workspace_ids()`
  - Returns array of workspace IDs for current user
  - Uses `SECURITY DEFINER` to bypass RLS
  - Queries `workspace_users` but bypasses RLS checks
  
**Note**: Policy 5 in this migration still had recursion (queries workspace_users directly)

### Migration 2: `20251220100000_fix_workspace_users_rls_v2.sql`
- **Purpose**: Drop all policies and recreate them cleanly
- **Issue**: Still had recursion in Policy 5 (Workspace admins can manage)

### Migration 3: `20251220110000_fix_workspace_users_rls_v3.sql` ✅ **FINAL**
- **Purpose**: Remove ALL recursion by using security definer functions
- **Key Function**: `is_workspace_admin_for(ws_id UUID)`
  - Checks if current user is admin in a specific workspace
  - Uses `SECURITY DEFINER` to bypass RLS
  - Queries `workspace_users` but bypasses RLS checks

## Final Policy Structure (v3)

1. **Users can view their own workspace membership**
   - Simple check: `user_id = auth.uid()`
   - No recursion ✅

2. **Users can view workspace users for their workspaces**
   - Uses: `workspace_id = ANY(public.get_current_user_workspace_ids())`
   - Function bypasses RLS ✅

3. **Platform admins can view all workspace users**
   - Uses: `is_platform_admin()`
   - No recursion ✅

4. **Platform admins can manage workspace users**
   - Uses: `is_platform_admin()`
   - No recursion ✅

5. **Workspace admins can manage workspace users**
   - Uses: `public.is_workspace_admin_for(workspace_id)`
   - Function bypasses RLS ✅

## Security Definer Functions

### `get_current_user_workspace_ids()`
```sql
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
```
- **Bypasses RLS**: Yes (SECURITY DEFINER)
- **Used by**: Policy 2

### `is_workspace_admin_for(ws_id UUID)`
```sql
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
```
- **Bypasses RLS**: Yes (SECURITY DEFINER)
- **Used by**: Policy 5

## Migration Order

1. ✅ `20251220000000_fix_workspace_users_rls_recursion.sql` - Creates `get_current_user_workspace_ids()`
2. ✅ `20251220100000_fix_workspace_users_rls_v2.sql` - Drops/recreates policies
3. ✅ `20251220110000_fix_workspace_users_rls_v3.sql` - Creates `is_workspace_admin_for()` and fixes all recursion

## Verification

All policies now use security definer functions that bypass RLS, eliminating recursion:
- ✅ No direct queries to `workspace_users` within policies
- ✅ All functions use `SECURITY DEFINER`
- ✅ Functions have proper grants to authenticated, anon, and service_role
- ✅ Policies are properly ordered and non-conflicting

## Testing Recommendations

1. Test that users can view their own workspace memberships
2. Test that users can view workspace_users for workspaces they belong to
3. Test that platform admins can view/manage all workspace_users
4. Test that workspace admins can manage workspace_users in their workspaces
5. Verify no 500 errors occur when querying workspace_users table

## Status: ✅ COMPLETE

All migrations are in place and ready to be applied. The v3 migration is the final fix and removes all recursion issues.

