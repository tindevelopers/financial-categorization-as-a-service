# Manual Edge Function Deployment Guide

The Supabase CLI deployment commands require interactive authentication. Follow these steps to deploy manually.

## Step 1: Ensure You're Logged In

```bash
supabase login
```

This will open a browser window for authentication.

## Step 2: Link Project (if not already linked)

```bash
supabase link --project-ref firwcvlikjltikdrmejq
```

## Step 3: Deploy Functions

From the project root directory:

```bash
# Temporarily rename .env.local to avoid parsing issues
mv .env.local .env.local.backup

# Deploy first function
supabase functions deploy get-tenant-credentials --project-ref firwcvlikjltikdrmejq --no-verify-jwt

# Deploy second function
supabase functions deploy set-tenant-credentials --project-ref firwcvlikjltikdrmejq --no-verify-jwt

# Restore .env.local
mv .env.local.backup .env.local
```

## Alternative: Deploy via Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/firwcvlikjltikdrmejq/functions
2. Click "Create a new function"
3. Name: `get-tenant-credentials`
4. Copy the contents of `supabase/functions/get-tenant-credentials/index.ts`
5. Paste into the editor
6. Click "Deploy"
7. Repeat for `set-tenant-credentials`

## Verify Deployment

After deployment, verify functions are available:

1. **Check Dashboard**: https://supabase.com/dashboard/project/firwcvlikjltikdrmejq/functions
   - Both functions should appear in the list

2. **Test via API**:
   ```bash
   curl -X POST "https://firwcvlikjltikdrmejq.supabase.co/functions/v1/get-tenant-credentials" \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "apikey: YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "tenant_id": "00000000-0000-0000-0000-000000000000",
       "provider": "google",
       "credential_type": "individual"
     }'
   ```

   Expected: `{"has_tenant_credentials": false, "credentials": null}`

## Troubleshooting

### "Not authenticated"
Run `supabase login` first

### "Project not found"
Run `supabase link --project-ref firwcvlikjltikdrmejq`

### "Function deployment failed"
- Check function code for syntax errors
- Ensure all imports are correct
- Check Supabase Dashboard logs for errors

### "Environment file parsing error"
Temporarily rename `.env.local` before deploying

