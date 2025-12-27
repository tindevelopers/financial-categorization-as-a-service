# Setting Tenant Secrets via Supabase CLI

## Prerequisites

1. **Authenticated with Supabase CLI**:
   ```bash
   supabase login
   ```

2. **Project linked** (if not already):
   ```bash
   supabase link --project-ref firwcvlikjltikdrmejq
   ```

## Your Tenant ID

**Tenant ID**: `9b74fb09-be2c-4b9b-814d-357337b3539c`  
**Tenant Name**: Gene's Organization

## Setting Secrets

### Format

The secret names follow this pattern:
```
TENANT_{TENANT_ID_UPPERCASE}_GOOGLE_INDIVIDUAL_CLIENT_ID
TENANT_{TENANT_ID_UPPERCASE}_GOOGLE_INDIVIDUAL_CLIENT_SECRET
```

Where `{TENANT_ID_UPPERCASE}` is the tenant ID with:
- All uppercase letters
- Hyphens replaced with underscores

### For Your Tenant

**Tenant ID**: `9b74fb09-be2c-4b9b-814d-357337b3539c`  
**Formatted**: `9B74FB09_BE2C_4B9B_814D_357337B3539C`

**Secret Names**:
- `TENANT_9B74FB09_BE2C_4B9B_814D_357337B3539C_GOOGLE_INDIVIDUAL_CLIENT_ID`
- `TENANT_9B74FB09_BE2C_4B9B_814D_357337B3539C_GOOGLE_INDIVIDUAL_CLIENT_SECRET`

### Commands to Run

```bash
cd /Users/gene/Projects/financial-categorization-as-a-service

# Temporarily rename .env.local to avoid parsing issues
mv .env.local .env.local.backup

# Set CLIENT_ID secret (replace with your actual Google OAuth Client ID)
supabase secrets set \
  --project-ref firwcvlikjltikdrmejq \
  "TENANT_9B74FB09_BE2C_4B9B_814D_357337B3539C_GOOGLE_INDIVIDUAL_CLIENT_ID=your-actual-client-id-here"

# Set CLIENT_SECRET secret (replace with your actual Google OAuth Client Secret)
supabase secrets set \
  --project-ref firwcvlikjltikdrmejq \
  "TENANT_9B74FB09_BE2C_4B9B_814D_357337B3539C_GOOGLE_INDIVIDUAL_CLIENT_SECRET=your-actual-client-secret-here"

# Restore .env.local
mv .env.local.backup .env.local
```

### Using Test Values (for testing only)

If you want to test the system with placeholder values:

```bash
cd /Users/gene/Projects/financial-categorization-as-a-service

mv .env.local .env.local.backup

# Set test CLIENT_ID
supabase secrets set \
  --project-ref firwcvlikjltikdrmejq \
  "TENANT_9B74FB09_BE2C_4B9B_814D_357337B3539C_GOOGLE_INDIVIDUAL_CLIENT_ID=test-client-id-12345"

# Set test CLIENT_SECRET
supabase secrets set \
  --project-ref firwcvlikjltikdrmejq \
  "TENANT_9B74FB09_BE2C_4B9B_814D_357337B3539C_GOOGLE_INDIVIDUAL_CLIENT_SECRET=test-client-secret-67890"

mv .env.local.backup .env.local
```

## Verify Secrets Are Set

```bash
# List all secrets (will show names only, not values)
supabase secrets list --project-ref firwcvlikjltikdrmejq | grep TENANT
```

## For Other Tenants

To set secrets for a different tenant:

1. **Get tenant ID**:
   ```bash
   supabase db query --project-ref firwcvlikjltikdrmejq "SELECT id, name FROM tenants;"
   ```

2. **Convert tenant ID to uppercase with underscores**:
   ```bash
   TENANT_ID="your-tenant-id-here"
   TENANT_ID_UPPER=$(echo "$TENANT_ID" | tr '[:lower:]' '[:upper:]' | tr '-' '_')
   echo "TENANT_${TENANT_ID_UPPER}_GOOGLE_INDIVIDUAL_CLIENT_ID"
   ```

3. **Set secrets using the formatted name**

## Next Steps

After setting secrets:

1. **Save credential metadata** via API:
   ```bash
   curl -X POST "http://localhost:3001/api/tenant/credentials/oauth" \
     -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "tenant_id": "9b74fb09-be2c-4b9b-814d-357337b3539c",
       "provider": "google",
       "credential_type": "individual",
       "client_id": "your-actual-client-id",
       "client_secret": "your-actual-client-secret",
       "redirect_uri": "https://your-domain.com/callback"
     }'
   ```

2. **Test credential retrieval**:
   - The system will now use tenant-specific credentials
   - Test Google Sheets export functionality
   - Monitor logs to confirm tenant credentials are being used

## Important Notes

- **Secrets are encrypted** and stored securely in Supabase Secrets Management
- **Secret names are case-sensitive** - use exact format shown above
- **Replace test values** with real OAuth credentials before production use
- **Secrets are accessible** only via Edge Functions (not directly from Next.js)

