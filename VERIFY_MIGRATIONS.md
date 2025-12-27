# Verify Migrations: Tenant OAuth Credentials

## Quick Verification Methods

### Method 1: Supabase Dashboard SQL Editor (Recommended)

1. Go to: https://supabase.com/dashboard/project/firwcvlikjltikdrmejq/sql/new
2. Copy and paste this SQL:

```sql
-- Verify migrations are applied
SELECT 
  'Table Check' as check_type,
  CASE WHEN EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'tenant_oauth_credentials'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

SELECT 
  'Functions Check' as check_type,
  COUNT(*)::text || ' functions found' as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'get_tenant_oauth_credentials',
  'get_tenant_oauth_credential_metadata',
  'save_tenant_oauth_credentials',
  'delete_tenant_oauth_credentials',
  'get_best_tenant_oauth_credentials',
  'list_tenant_oauth_credentials'
);

SELECT 
  'Indexes Check' as check_type,
  COUNT(*)::text || ' indexes found' as status
FROM pg_indexes
WHERE tablename = 'tenant_oauth_credentials'
AND indexname LIKE 'idx_tenant_oauth_credentials%';

-- Check RLS is enabled
SELECT 
  'RLS Check' as check_type,
  CASE WHEN relrowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as status
FROM pg_class
WHERE relname = 'tenant_oauth_credentials';
```

3. Expected Results:
   - Table Check: ✅ EXISTS
   - Functions Check: 5 functions found (or 6 if get_tenant_oauth_credentials exists)
   - Indexes Check: 5 indexes found
   - RLS Check: ✅ ENABLED

### Method 2: Supabase Dashboard Table Browser

1. Go to: https://supabase.com/dashboard/project/firwcvlikjltikdrmejq/editor
2. Look for table: `tenant_oauth_credentials`
3. If it exists, click on it to verify columns:
   - id, tenant_id, provider, credential_type
   - client_id_secret_name, client_secret_secret_name
   - service_account_email, service_account_secret_name
   - redirect_uri, is_active, created_at, updated_at

### Method 3: Test RPC Functions

Run this SQL in Supabase SQL Editor:

```sql
-- Test 1: Get metadata (should work even with no data)
SELECT * FROM get_tenant_oauth_credential_metadata(
  '00000000-0000-0000-0000-000000000000'::uuid,
  'google',
  'individual'
);

-- Test 2: List credentials (should return empty array)
SELECT * FROM list_tenant_oauth_credentials('00000000-0000-0000-0000-000000000000'::uuid);

-- Test 3: Get best credentials (should return has_tenant_credentials: false)
SELECT * FROM get_best_tenant_oauth_credentials(
  '00000000-0000-0000-0000-000000000000'::uuid,
  'google',
  'individual'
);
```

If these queries run without errors, migrations are applied.

### Method 4: Check Migration History

Run this SQL:

```sql
SELECT version, name, inserted_at
FROM supabase_migrations.schema_migrations
WHERE name LIKE '%tenant_oauth%'
ORDER BY inserted_at DESC;
```

Expected: Should show 2 migrations:
- `20251228000000_create_tenant_oauth_credentials`
- `20251228000001_create_tenant_oauth_rpc_functions`

## If Migrations Are Not Applied

1. Go to Supabase Dashboard > SQL Editor
2. Open file: `supabase/migrations/APPLY_TENANT_OAUTH_MIGRATIONS.sql`
3. Copy all contents
4. Paste into SQL Editor
5. Click "Run" or press Cmd/Ctrl + Enter
6. Verify success message
7. Re-run verification queries above

## Verification Checklist

- [ ] Table `tenant_oauth_credentials` exists
- [ ] All 5 RPC functions exist
- [ ] Indexes are created (5 indexes)
- [ ] RLS is enabled on table
- [ ] Trigger `update_tenant_oauth_credentials_updated_at` exists
- [ ] Can query table (even if empty)
- [ ] Can call RPC functions (even with dummy data)

## Next Steps After Verification

Once migrations are confirmed:

1. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy get-tenant-credentials --linked
   supabase functions deploy set-tenant-credentials --linked
   ```

2. **Test API Endpoints**:
   - Use the test scripts or follow TESTING_GUIDE.md

3. **Set Test Secrets** (optional):
   ```bash
   # Get a tenant ID first
   supabase db query --linked "SELECT id FROM tenants LIMIT 1;"
   
   # Set test secrets
   supabase secrets set TENANT_{TENANT_ID}_GOOGLE_INDIVIDUAL_CLIENT_ID="test-id"
   supabase secrets set TENANT_{TENANT_ID}_GOOGLE_INDIVIDUAL_CLIENT_SECRET="test-secret"
   ```

