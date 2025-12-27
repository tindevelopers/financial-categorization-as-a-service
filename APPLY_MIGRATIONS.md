# Applying Tenant OAuth Credentials Migrations

## Migration Files Created

1. `supabase/migrations/20251228000000_create_tenant_oauth_credentials.sql`
   - Creates `tenant_oauth_credentials` table
   - Sets up RLS policies
   - Creates indexes

2. `supabase/migrations/20251228000001_create_tenant_oauth_rpc_functions.sql`
   - Creates RPC functions for credential management
   - Implements fallback logic

## Method 1: Using Supabase CLI (Recommended)

### Step 1: Ensure you're logged in
```bash
supabase login
```

### Step 2: Link to your project (if not already linked)
```bash
supabase link --project-ref firwcvlikjltikdrmejq
```

### Step 3: Apply migrations
```bash
# Temporarily rename .env.local to avoid parsing issues
mv .env.local .env.local.backup

# Apply all pending migrations
supabase db push --linked --include-all

# Restore .env.local
mv .env.local.backup .env.local
```

### Step 4: Deploy Edge Functions
```bash
# Deploy get-tenant-credentials function
supabase functions deploy get-tenant-credentials --linked

# Deploy set-tenant-credentials function
supabase functions deploy set-tenant-credentials --linked
```

## Method 2: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of each migration file
4. Run them in order:
   - First: `20251228000000_create_tenant_oauth_credentials.sql`
   - Second: `20251228000001_create_tenant_oauth_rpc_functions.sql`

## Method 3: Using psql (Direct Database Connection)

If you have direct database access:

```bash
# Get your database connection string from Supabase Dashboard
# Settings > Database > Connection string

# Apply first migration
psql "your-connection-string" -f supabase/migrations/20251228000000_create_tenant_oauth_credentials.sql

# Apply second migration
psql "your-connection-string" -f supabase/migrations/20251228000001_create_tenant_oauth_rpc_functions.sql
```

## Verifying Migrations

After applying migrations, verify they were created:

```sql
-- Check if table exists
SELECT * FROM tenant_oauth_credentials LIMIT 1;

-- Check if functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%tenant_oauth%';
```

## Deploying Edge Functions

After migrations are applied, deploy the Edge Functions:

```bash
# Navigate to functions directory
cd supabase/functions

# Deploy get-tenant-credentials
cd get-tenant-credentials
supabase functions deploy get-tenant-credentials --linked

# Deploy set-tenant-credentials
cd ../set-tenant-credentials
supabase functions deploy set-tenant-credentials --linked
```

## Troubleshooting

### Issue: "failed to parse environment file"
**Solution:** Temporarily rename `.env.local` before running commands:
```bash
mv .env.local .env.local.backup
# Run your command
mv .env.local.backup .env.local
```

### Issue: "Found local migration files to be inserted before the last migration"
**Solution:** Use `--include-all` flag:
```bash
supabase db push --linked --include-all
```

### Issue: Edge Functions not deploying
**Solution:** Ensure you're in the correct directory and function structure is correct:
```bash
supabase functions deploy get-tenant-credentials --linked --no-verify-jwt
```

## Next Steps

After migrations are applied:

1. Test the RPC functions:
   ```sql
   SELECT get_tenant_oauth_credential_metadata('your-tenant-id', 'google', 'individual');
   ```

2. Test Edge Functions via API:
   ```bash
   curl -X POST https://firwcvlikjltikdrmejq.supabase.co/functions/v1/get-tenant-credentials \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"tenant_id": "your-tenant-id", "provider": "google", "credential_type": "individual"}'
   ```

3. Run migration script to move existing credentials:
   ```bash
   tsx scripts/migrate-to-supabase-secrets.ts
   ```

