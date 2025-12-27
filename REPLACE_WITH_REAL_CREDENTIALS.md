# Replace Test Credentials with Real Google OAuth Credentials

## Step 1: Get Your Google OAuth Credentials

### Option A: Create New OAuth Credentials

1. **Go to Google Cloud Console**:
   - Visit: https://console.cloud.google.com/
   - Select your project (or create a new one)

2. **Enable Google Sheets API** (if not already enabled):
   - Go to: APIs & Services > Library
   - Search for "Google Sheets API"
   - Click "Enable"

3. **Create OAuth 2.0 Credentials**:
   - Go to: APIs & Services > Credentials
   - Click "Create Credentials" > "OAuth client ID"
   - If prompted, configure the OAuth consent screen first
   - Choose application type: "Web application"
   - Name: "Financial Categorization - Tenant OAuth"
   - Authorized redirect URIs: Add your callback URL (e.g., `https://your-domain.com/api/integrations/google-sheets/callback`)
   - Click "Create"
   - **Copy the Client ID and Client Secret**

### Option B: Use Existing Credentials

If you already have Google OAuth credentials:
- Go to: Google Cloud Console > APIs & Services > Credentials
- Find your OAuth 2.0 Client ID
- Click to view details
- **Copy the Client ID and Client Secret**

## Step 2: Set the Real Credentials

Run these commands in your terminal, replacing `your-real-client-id` and `your-real-client-secret` with your actual values:

```bash
cd /Users/gene/Projects/financial-categorization-as-a-service

# Temporarily rename .env.local to avoid parsing issues
mv .env.local .env.local.backup

# Set the real CLIENT_ID (replace with your actual value)
supabase secrets set --project-ref firwcvlikjltikdrmejq \
  "TENANT_9b74fb09-be2c-4b9b-814d-357337b3539c_GOOGLE_INDIVIDUAL_CLIENT_ID=your-real-client-id"

# Set the real CLIENT_SECRET (replace with your actual value)
supabase secrets set --project-ref firwcvlikjltikdrmejq \
  "TENANT_9b74fb09-be2c-4b9b-814d-357337b3539c_GOOGLE_INDIVIDUAL_CLIENT_SECRET=your-real-client-secret"

# Restore .env.local
mv .env.local.backup .env.local
```

### Example with Real Values

```bash
# Example (DO NOT use these - they're just examples)
supabase secrets set --project-ref firwcvlikjltikdrmejq \
  "TENANT_9b74fb09-be2c-4b9b-814d-357337b3539c_GOOGLE_INDIVIDUAL_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com"

supabase secrets set --project-ref firwcvlikjltikdrmejq \
  "TENANT_9b74fb09-be2c-4b9b-814d-357337b3539c_GOOGLE_INDIVIDUAL_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz"
```

## Step 3: Verify Credentials Are Set

```bash
# List secrets to verify (will show names, not values)
supabase secrets list --project-ref firwcvlikjltikdrmejq | grep TENANT_9b74fb09
```

You should see both secrets listed.

## Step 4: Test Credential Retrieval

Test that the Edge Function can retrieve your real credentials:

```bash
# Get your Supabase URL and Service Role Key from .env.local
SUPABASE_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.local | cut -d'=' -f2- | tr -d '"' | tr -d "'")
SUPABASE_KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" .env.local | cut -d'=' -f2- | tr -d '"' | tr -d "'")

# Test retrieval (will show client_id but not client_secret for security)
curl -X POST "${SUPABASE_URL}/functions/v1/get-tenant-credentials" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "9b74fb09-be2c-4b9b-814d-357337b3539c",
    "provider": "google",
    "credential_type": "individual"
  }' | python3 -m json.tool
```

Expected response:
```json
{
    "has_tenant_credentials": true,
    "credentials": {
        "client_id": "your-real-client-id",
        "client_secret": "your-real-client-secret",
        ...
    }
}
```

## Step 5: Update Redirect URI (if needed)

If you need to update the redirect URI in the metadata:

```bash
# Update via API or SQL
# The redirect_uri is currently set to: https://example.com/callback
# Update it to your actual callback URL if different
```

## Important Notes

1. **Keep credentials secure**: Never commit OAuth credentials to git
2. **Redirect URI must match**: The redirect URI in Google Cloud Console must match your application's callback URL
3. **Test in development first**: Test with a development OAuth app before using production credentials
4. **Multiple tenants**: Each tenant can have their own OAuth credentials

## Troubleshooting

### "Invalid client_id_secret_name format"
- Make sure you're using the exact format: `TENANT_{tenant-id}_GOOGLE_INDIVIDUAL_CLIENT_ID`
- Tenant ID should be lowercase with hyphens

### "Secret not found"
- Verify the secret name matches exactly (case-sensitive)
- Check with: `supabase secrets list --project-ref firwcvlikjltikdrmejq`

### "OAuth flow fails"
- Verify redirect URI matches in Google Cloud Console
- Check that Google Sheets API is enabled
- Ensure credentials are for the correct Google Cloud project

