# Deploy Edge Functions: Tenant OAuth Credentials

## Prerequisites

1. **Supabase CLI installed and logged in**:
   ```bash
   supabase login
   ```

2. **Project linked**:
   ```bash
   supabase link --project-ref firwcvlikjltikdrmejq
   ```

## Deployment Commands

### Deploy get-tenant-credentials Function

```bash
cd /Users/gene/Projects/financial-categorization-as-a-service

# Temporarily rename .env.local to avoid parsing issues
mv .env.local .env.local.backup

# Deploy the function
supabase functions deploy get-tenant-credentials --linked

# Restore .env.local
mv .env.local.backup .env.local
```

### Deploy set-tenant-credentials Function

```bash
cd /Users/gene/Projects/financial-categorization-as-a-service

# Temporarily rename .env.local to avoid parsing issues
mv .env.local .env.local.backup

# Deploy the function
supabase functions deploy set-tenant-credentials --linked

# Restore .env.local
mv .env.local.backup .env.local
```

## Alternative: Deploy Both at Once

```bash
cd /Users/gene/Projects/financial-categorization-as-a-service

mv .env.local .env.local.backup

supabase functions deploy get-tenant-credentials --linked
supabase functions deploy set-tenant-credentials --linked

mv .env.local.backup .env.local
```

## Verify Deployment

After deployment, verify functions are available:

1. **Check Supabase Dashboard**:
   - Go to: https://supabase.com/dashboard/project/firwcvlikjltikdrmejq/functions
   - You should see both functions listed

2. **Test via API**:
   ```bash
   # Get your project URL and service role key
   SUPABASE_URL="https://firwcvlikjltikdrmejq.supabase.co"
   SERVICE_ROLE_KEY="your-service-role-key"
   
   # Test get-tenant-credentials
   curl -X POST "${SUPABASE_URL}/functions/v1/get-tenant-credentials" \
     -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
     -H "apikey: ${SERVICE_ROLE_KEY}" \
     -H "Content-Type: application/json" \
     -d '{
       "tenant_id": "00000000-0000-0000-0000-000000000000",
       "provider": "google",
       "credential_type": "individual"
     }'
   ```

   Expected response: `{"has_tenant_credentials": false, "credentials": null}`

## Troubleshooting

### "Not logged in"
**Solution**: Run `supabase login` first

### "Project not linked"
**Solution**: Run `supabase link --project-ref firwcvlikjltikdrmejq`

### "Function deployment failed"
**Solution**: 
- Check function code for syntax errors
- Ensure Deno imports are correct
- Check Supabase Dashboard for error logs

### "Environment file parsing error"
**Solution**: Temporarily rename `.env.local` before deploying:
```bash
mv .env.local .env.local.backup
# deploy commands
mv .env.local.backup .env.local
```

## Function URLs After Deployment

Once deployed, functions will be available at:

- `https://firwcvlikjltikdrmejq.supabase.co/functions/v1/get-tenant-credentials`
- `https://firwcvlikjltikdrmejq.supabase.co/functions/v1/set-tenant-credentials`

These URLs are automatically used by `SupabaseCredentialManager` in the code.

## Next Steps

After successful deployment:

1. Test the functions using the API endpoints
2. Set test secrets: `supabase secrets set TENANT_{ID}_GOOGLE_INDIVIDUAL_CLIENT_ID="test"`
3. Test credential retrieval via your Next.js API routes
4. Monitor function logs in Supabase Dashboard

