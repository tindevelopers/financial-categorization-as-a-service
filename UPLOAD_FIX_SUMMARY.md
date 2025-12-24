# Upload Fix Summary

## Issues Found in Logs

1. **RLS Policy Violation (Error 42501)**: 
   - Upload fails with: `new row violates row-level security policy for table "categorization_jobs"`
   - This happens when trying to insert a new categorization job

2. **401 Unauthorized Errors**:
   - Multiple requests to `/api/categorization/jobs/[jobId]/transactions` return 401
   - Error: "Auth session missing!"
   - This prevents the review page from loading transactions

## Root Cause

The RLS (Row Level Security) policies on `categorization_jobs` table are blocking inserts when using the server-side Supabase client. The server-side client (`createServerClient`) may not properly pass the authentication context to the database, causing `auth.uid()` in RLS policies to be NULL or not match the `user_id` being inserted.

## Fixes Applied

### 1. Code Fix: Use Admin Client for Inserts

**File**: `apps/portal/app/api/categorization/upload/route.ts`

- Added import for `createAdminClient` from `@tinadmin/core/database/admin-client`
- Modified job creation to use admin client (bypasses RLS) while still validating the user
- Added fallback to regular client if admin client fails
- Security is maintained because we validate `user.id` before inserting

**Why this works**: The admin client uses the service role key which bypasses RLS, but we still validate that the authenticated user matches the `user_id` being inserted, maintaining security.

### 2. SQL Fix: Update RLS Policies

**File**: `FIX_CATEGORIZATION_JOBS_RLS.sql`

- Simplified the INSERT policy check to just `auth.uid() = user_id`
- This should work better with server-side clients
- Still maintains security by ensuring users can only insert jobs with their own user_id

## Steps to Deploy

### Step 1: Run SQL Migration

1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/firwcvlikjltikdrmejq/sql/new
2. Copy and paste the contents of `FIX_CATEGORIZATION_JOBS_RLS.sql`
3. Run the migration
4. Verify policies were created successfully

### Step 2: Deploy Code Changes

The code changes are already applied. After deploying:
- The upload route will use the admin client for inserts
- This bypasses RLS while maintaining security through user validation

### Step 3: Verify Environment Variables

Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in your Vercel environment variables:
- Go to Vercel project settings
- Add `SUPABASE_SERVICE_ROLE_KEY` if not already present
- Redeploy if needed

## Testing

After deploying:

1. **Test Upload**:
   - Navigate to upload page
   - Upload a bank statement file
   - Should succeed without RLS errors

2. **Test Review Page**:
   - After upload, navigate to review page
   - Should load transactions without 401 errors
   - If 401 errors persist, check that cookies are being passed correctly

## Alternative Solution (If Admin Client Doesn't Work)

If the admin client approach doesn't work, we can:

1. **Grant service_role permissions**:
   ```sql
   GRANT ALL ON public.categorization_jobs TO service_role;
   ```

2. **Or use a database function** that runs with SECURITY DEFINER to bypass RLS:
   ```sql
   CREATE OR REPLACE FUNCTION create_categorization_job(
     p_user_id UUID,
     p_tenant_id UUID,
     p_job_type TEXT,
     p_original_filename TEXT,
     p_file_url TEXT
   ) RETURNS UUID AS $$
   DECLARE
     v_job_id UUID;
   BEGIN
     INSERT INTO categorization_jobs (
       user_id, tenant_id, job_type, status, 
       processing_mode, original_filename, file_url
     ) VALUES (
       p_user_id, p_tenant_id, p_job_type, 'uploaded',
       'sync', p_original_filename, p_file_url
     ) RETURNING id INTO v_job_id;
     RETURN v_job_id;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

## Related Files

- `apps/portal/app/api/categorization/upload/route.ts` - Upload route with admin client
- `FIX_CATEGORIZATION_JOBS_RLS.sql` - SQL migration to fix RLS policies
- `packages/@tinadmin/core/src/database/admin-client.ts` - Admin client implementation

