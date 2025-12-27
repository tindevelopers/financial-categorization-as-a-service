# Testing Guide: Tenant OAuth Credentials

## Prerequisites

1. **Migrations Applied**: Ensure migrations are applied to your remote Supabase database
   - Option 1: Via Supabase Dashboard SQL Editor (recommended)
     - Go to: https://supabase.com/dashboard/project/firwcvlikjltikdrmejq/sql/new
     - Copy contents of `supabase/migrations/APPLY_TENANT_OAUTH_MIGRATIONS.sql`
     - Paste and run
   
   - Option 2: Via CLI
     ```bash
     supabase db push --linked --include-all
     ```

2. **Edge Functions Deployed**:
   ```bash
   supabase functions deploy get-tenant-credentials --linked
   supabase functions deploy set-tenant-credentials --linked
   ```

3. **Dev Server Running**:
   ```bash
   pnpm dev
   ```

## Testing Steps

### Step 1: Verify Migrations Applied

Run this SQL in Supabase SQL Editor:

```sql
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'tenant_oauth_credentials'
) as table_exists;

-- Check if functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%tenant_oauth%';
```

Expected: Should return `table_exists: true` and list of 5 functions.

### Step 2: Test RPC Functions

Run in Supabase SQL Editor (replace `YOUR_TENANT_ID`):

```sql
-- Test 1: Get metadata (should return empty if no credentials)
SELECT * FROM get_tenant_oauth_credential_metadata(
  'YOUR_TENANT_ID'::uuid,
  'google',
  'individual'
);

-- Test 2: List credentials (should return empty array)
SELECT * FROM list_tenant_oauth_credentials('YOUR_TENANT_ID'::uuid);

-- Test 3: Get best credentials (should return has_tenant_credentials: false)
SELECT * FROM get_best_tenant_oauth_credentials(
  'YOUR_TENANT_ID'::uuid,
  'google',
  'individual'
);
```

### Step 3: Test API Endpoints

#### Test 1: List Credentials (GET)

```bash
# Get your auth token first (sign in via browser, get token from cookies/localStorage)
curl -X GET "http://localhost:3001/api/tenant/credentials/oauth?tenant_id=YOUR_TENANT_ID" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json"
```

Expected: `{"tenant_id": "...", "credentials": []}`

#### Test 2: Test Credentials (POST)

```bash
curl -X POST "http://localhost:3001/api/tenant/credentials/test" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "YOUR_TENANT_ID",
    "provider": "google",
    "credential_type": "individual"
  }'
```

Expected: `{"success": false, "error": "No tenant credentials found"}` (if no credentials set)

### Step 4: Test Google Sheets Export

1. Navigate to: http://localhost:3001
2. Sign in
3. Create or open a categorization job
4. Try to export to Google Sheets
5. Monitor browser console and network tab for:
   - Credential retrieval
   - Fallback to platform credentials
   - Service account usage

### Step 5: Test Setting Credentials (Full Flow)

1. **Set secrets in Supabase** (via CLI):
   ```bash
   # Get a tenant ID first
   supabase db query "SELECT id FROM tenants LIMIT 1;"
   
   # Set secrets (replace TENANT_ID with actual UUID)
   supabase secrets set TENANT_TENANT_ID_GOOGLE_INDIVIDUAL_CLIENT_ID="test-client-id"
   supabase secrets set TENANT_TENANT_ID_GOOGLE_INDIVIDUAL_CLIENT_SECRET="test-client-secret"
   ```

2. **Save credential metadata** (via API):
   ```bash
   curl -X POST "http://localhost:3001/api/tenant/credentials/oauth" \
     -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "tenant_id": "YOUR_TENANT_ID",
       "provider": "google",
       "credential_type": "individual",
       "client_id": "test-client-id",
       "client_secret": "test-client-secret",
       "redirect_uri": "https://example.com/callback"
     }'
   ```

3. **Verify credentials are saved**:
   ```bash
   curl -X GET "http://localhost:3001/api/tenant/credentials/oauth?tenant_id=YOUR_TENANT_ID&provider=google&credential_type=individual" \
     -H "Authorization: Bearer YOUR_AUTH_TOKEN"
   ```

4. **Test credential retrieval**:
   - The system should now use tenant-specific credentials
   - Test Google Sheets export again
   - Should use tenant credentials instead of platform defaults

## Monitoring Progress

### Browser DevTools

1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter by "api/tenant" or "api/categorization"
4. Monitor requests and responses

### Server Logs

Watch the dev server logs for:
- Credential manager calls
- Supabase Edge Function calls
- Fallback messages
- Error messages

### Supabase Logs

1. Go to Supabase Dashboard > Logs
2. Check Edge Function logs
3. Check Database logs for RPC function calls

## Expected Behavior

### Without Tenant Credentials
- System falls back to Vercel env vars (`GOOGLE_CLIENT_ID`, etc.)
- OAuth flows work with platform credentials
- Google Sheets export uses platform service account

### With Tenant Credentials
- System uses tenant-specific credentials from Supabase Secrets
- OAuth flows use tenant's OAuth app
- Google Sheets export can use tenant's service account (if corporate)

## Troubleshooting

### "Table does not exist"
**Solution**: Apply migrations via SQL Editor or CLI

### "Function does not exist"
**Solution**: Apply migration `20251228000001_create_tenant_oauth_rpc_functions.sql`

### "Edge Function error"
**Solution**: Deploy Edge Functions:
```bash
supabase functions deploy get-tenant-credentials --linked
supabase functions deploy set-tenant-credentials --linked
```

### "Secrets not found"
**Solution**: Set secrets via CLI before saving metadata:
```bash
supabase secrets set TENANT_{ID}_GOOGLE_INDIVIDUAL_CLIENT_ID="value"
```

### API returns 401 Unauthorized
**Solution**: Sign in first, get auth token from browser DevTools > Application > Cookies

## Quick Test Checklist

- [ ] Migrations applied (table and functions exist)
- [ ] Edge Functions deployed
- [ ] Can list credentials (empty initially)
- [ ] Can test credentials (returns "not found" initially)
- [ ] Can set secrets via CLI
- [ ] Can save credential metadata via API
- [ ] Can retrieve credentials via API
- [ ] Google Sheets export works (with fallback)
- [ ] OAuth flows work (with fallback)
