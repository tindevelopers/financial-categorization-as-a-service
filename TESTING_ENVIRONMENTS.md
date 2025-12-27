# Testing Tenant OAuth Credentials: Localhost vs Vercel

## ✅ Both Environments Should Work

The tenant OAuth credentials system works in **both localhost and Vercel** because:

1. **Edge Functions are deployed to Supabase** (not Vercel)
   - Accessible from anywhere: `https://firwcvlikjltikdrmejq.supabase.co/functions/v1/...`
   - Already deployed and tested ✅

2. **Database is remote Supabase**
   - Accessible from both localhost and Vercel
   - Migrations already applied ✅

3. **Secrets are in Supabase Secrets Management**
   - Accessible via Edge Functions from anywhere ✅

## Required Environment Variables

Both environments need these variables:

### Required Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://firwcvlikjltikdrmejq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Optional (for fallback)
```
GOOGLE_CLIENT_ID=your-platform-client-id
GOOGLE_CLIENT_SECRET=your-platform-client-secret
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@...
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=your-private-key
```

## Testing Strategy

### Step 1: Test Locally First ✅

**Why test locally first:**
- Faster iteration
- Easier debugging
- No deployment needed
- Can see logs immediately

**How to test:**

1. **Start dev server:**
   ```bash
   pnpm dev
   ```

2. **Test API endpoint:**
   ```bash
   curl http://localhost:3001/api/tenant/credentials/oauth?tenant_id=9b74fb09-be2c-4b9b-814d-357337b3539c&provider=google&credential_type=individual
   ```

3. **Test Google Sheets export:**
   - Navigate to a categorization job
   - Try exporting to Google Sheets
   - Check browser console and server logs

### Step 2: Verify Vercel Environment Variables

**Before deploying to Vercel, ensure:**

1. **Go to Vercel Dashboard:**
   - Project Settings → Environment Variables

2. **Add/Verify these variables:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://firwcvlikjltikdrmejq.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Redeploy after adding variables:**
   - Vercel needs a new deployment to pick up environment variables

### Step 3: Test on Vercel

**After deployment:**

1. **Test API endpoint:**
   ```bash
   curl https://your-app.vercel.app/api/tenant/credentials/oauth?tenant_id=9b74fb09-be2c-4b9b-814d-357337b3539c&provider=google&credential_type=individual
   ```

2. **Test Google Sheets export:**
   - Navigate to your deployed app
   - Try exporting to Google Sheets
   - Check Vercel function logs

## Differences Between Environments

| Feature | Localhost | Vercel |
|---------|-----------|--------|
| Edge Functions | ✅ Works | ✅ Works |
| Database Access | ✅ Works | ✅ Works |
| Secrets Access | ✅ Works | ✅ Works |
| Environment Variables | `.env.local` | Vercel Dashboard |
| Logs | Terminal | Vercel Dashboard |
| Debugging | Easier | Check function logs |

## Troubleshooting

### Localhost Issues

**"NEXT_PUBLIC_SUPABASE_URL is not set"**
- Check `.env.local` file exists
- Verify variable name is correct
- Restart dev server after changes

**"Edge Function not found"**
- Verify Edge Functions are deployed:
  ```bash
  supabase functions list --project-ref firwcvlikjltikdrmejq
  ```

### Vercel Issues

**"Environment variable not found"**
- Go to Vercel Dashboard → Settings → Environment Variables
- Add missing variables
- Redeploy the project

**"Edge Function returns 401"**
- Check `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel
- Verify the key is correct
- Check Vercel function logs for errors

**"Credentials not retrieved"**
- Check Vercel function logs
- Verify tenant ID is correct
- Test Edge Function directly:
  ```bash
  curl -X POST "https://firwcvlikjltikdrmejq.supabase.co/functions/v1/get-tenant-credentials" \
    -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
    -H "apikey: YOUR_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"tenant_id":"9b74fb09-be2c-4b9b-814d-357337b3539c","provider":"google","credential_type":"individual"}'
  ```

## Recommended Testing Flow

1. ✅ **Test locally first** - Verify everything works
2. ✅ **Check Vercel env vars** - Ensure all variables are set
3. ✅ **Deploy to Vercel** - Push changes
4. ✅ **Test on Vercel** - Verify production behavior
5. ✅ **Monitor logs** - Check both environments for issues

## Quick Test Commands

### Localhost
```bash
# Test credential retrieval
curl http://localhost:3001/api/tenant/credentials/oauth?tenant_id=9b74fb09-be2c-4b9b-814d-357337b3539c&provider=google&credential_type=individual

# Test Edge Function directly
curl -X POST "https://firwcvlikjltikdrmejq.supabase.co/functions/v1/get-tenant-credentials" \
  -H "Authorization: Bearer $(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d'=' -f2)" \
  -H "apikey: $(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d'=' -f2)" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"9b74fb09-be2c-4b9b-814d-357337b3539c","provider":"google","credential_type":"individual"}'
```

### Vercel
```bash
# Replace YOUR_APP_URL with your actual Vercel URL
curl https://YOUR_APP_URL.vercel.app/api/tenant/credentials/oauth?tenant_id=9b74fb09-be2c-4b9b-814d-357337b3539c&provider=google&credential_type=individual
```

## Summary

**✅ Test locally first** - It's faster and easier to debug  
**✅ Then test on Vercel** - Ensure production works  
**✅ Both should work** - Edge Functions are accessible from anywhere  
**✅ Check environment variables** - Both environments need the same variables

