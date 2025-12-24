# Fix Summary: Categorization Jobs Upload Errors

## Issues Identified

Based on the error messages shown in the browser console:

1. **Missing `filename` column error**: 
   - Error: `column categorization_jobs.filename does not exist`
   - Root cause: Frontend code was querying `filename` instead of `original_filename`

2. **RLS Policy Violation**:
   - Error: `new row violates row-level security policy for table "categorization_jobs"`
   - Root cause: RLS policies may not be correctly configured or the user context isn't being passed properly

3. **500 Internal Server Error**:
   - Error: POST request to `/api/categorization/upload` returned 500
   - Root cause: Likely caused by the RLS policy violation preventing job creation

## Fixes Applied

### 1. Code Fixes

**File: `src/app/dashboard/uploads/page.tsx`**
- Changed `filename` to `original_filename` in the interface and query
- Updated the display to use `original_filename`

**File: `apps/portal/app/api/categorization/upload/route.ts`**
- Added detailed error logging to help diagnose RLS issues
- Error response now includes error code and details

### 2. SQL Migration

**File: `FIX_CATEGORIZATION_JOBS_RLS.sql`**
- Ensures `original_filename` column exists
- Drops and recreates RLS policies with explicit checks
- Adds verification queries to confirm the setup

## Steps to Apply the Fix

### Step 1: Run the SQL Migration

1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/firwcvlikjltikdrmejq/sql/new
2. Copy and paste the contents of `FIX_CATEGORIZATION_JOBS_RLS.sql`
3. Run the migration
4. Verify the output shows policies were created successfully

### Step 2: Verify the Fix

After running the SQL migration, test the upload functionality:

1. Navigate to the upload page
2. Upload a bank statement file
3. Check the browser console for errors
4. Verify the job is created successfully

### Step 3: Check Error Logs

If errors persist, check:
- Browser console for detailed error messages
- Server logs for RLS policy violations
- Verify the user is properly authenticated (check cookies/session)

## Additional Notes

- The RLS policies require that `auth.uid()` matches `user_id` exactly
- Ensure the Supabase client is properly configured with cookies for server-side requests
- The `createClient()` function in `apps/portal/lib/database/server.ts` should handle session management automatically

## Troubleshooting

If RLS errors persist:

1. **Check authentication**: Verify `supabase.auth.getUser()` returns a valid user
2. **Check user_id**: Ensure `user.id` matches what's stored in the database
3. **Check RLS policies**: Run the verification query in the SQL script to see all policies
4. **Check session**: Ensure cookies are being passed correctly from frontend to API route

## Related Files

- `FIX_CATEGORIZATION_JOBS_RLS.sql` - SQL migration to fix RLS policies
- `src/app/dashboard/uploads/page.tsx` - Fixed to use `original_filename`
- `apps/portal/app/api/categorization/upload/route.ts` - Added error logging
- `supabase/migrations/20251219020000_create_categorization_tables.sql` - Original migration

