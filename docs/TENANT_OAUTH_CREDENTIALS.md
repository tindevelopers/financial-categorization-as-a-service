# Tenant OAuth Credentials Management

This document explains how to manage tenant-specific OAuth credentials using Supabase Secrets Management.

## Overview

The system uses a two-tier credential storage strategy:

1. **Vercel Environment Variables** - Core system credentials (default OAuth, service accounts, API keys)
2. **Supabase Secrets Management** - Tenant-specific OAuth credentials (individual and corporate)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                      │
│  (Google Sheets, Google Drive, Dropbox OAuth flows)         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              VercelCredentialManager                        │
│  • Checks Supabase Secrets first                            │
│  • Falls back to Vercel env vars                            │
└───────────────┬───────────────────────┬─────────────────────┘
                │                       │
                ▼                       ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│ SupabaseCredentialManager│  │   Vercel Env Vars           │
│  • Calls Edge Functions  │  │   • GOOGLE_CLIENT_ID        │
│  • Accesses Supabase     │  │   • GOOGLE_CLIENT_SECRET    │
│    Secrets               │  │   • GOOGLE_SERVICE_ACCOUNT  │
└───────────┬──────────────┘  └──────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│         Supabase Edge Functions                            │
│  • get-tenant-credentials                                  │
│  • set-tenant-credentials                                  │
└───────────┬─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│         Supabase Secrets Management                        │
│  • Encrypted at rest                                        │
│  • Accessed via Deno.env.get() in Edge Functions           │
└─────────────────────────────────────────────────────────────┘
```

## Credential Storage Locations

### Vercel Environment Variables (Core System)

These credentials ensure the system runs and provide fallback OAuth:

- `GOOGLE_CLIENT_ID` - Default Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Default Google OAuth client secret
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Platform Google Service Account email
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` - Platform Google Service Account private key
- `DROPBOX_APP_KEY` - Default Dropbox OAuth app key
- `DROPBOX_APP_SECRET` - Default Dropbox OAuth app secret
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `ENCRYPTION_KEY` - Application encryption key

### Supabase Secrets Management (Tenant-Specific)

Tenant-specific OAuth credentials are stored in Supabase Secrets with the naming convention:

```
TENANT_{TENANT_ID}_{PROVIDER}_{TYPE}_{FIELD}
```

Examples:
- `TENANT_ABC123_GOOGLE_INDIVIDUAL_CLIENT_ID`
- `TENANT_ABC123_GOOGLE_INDIVIDUAL_CLIENT_SECRET`
- `TENANT_ABC123_GOOGLE_CORPORATE_CLIENT_ID`
- `TENANT_ABC123_GOOGLE_CORPORATE_SERVICE_ACCOUNT_PRIVATE_KEY`

## Setting Up Tenant Credentials

### Step 1: Set Secrets in Supabase

Use the Supabase CLI to set secrets:

```bash
# For individual tenant OAuth credentials
supabase secrets set TENANT_{tenantId}_GOOGLE_INDIVIDUAL_CLIENT_ID="your-client-id"
supabase secrets set TENANT_{tenantId}_GOOGLE_INDIVIDUAL_CLIENT_SECRET="your-client-secret"

# For corporate tenant OAuth credentials (with service account)
supabase secrets set TENANT_{tenantId}_GOOGLE_CORPORATE_CLIENT_ID="your-client-id"
supabase secrets set TENANT_{tenantId}_GOOGLE_CORPORATE_CLIENT_SECRET="your-client-secret"
supabase secrets set TENANT_{tenantId}_GOOGLE_CORPORATE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Step 2: Save Credential Metadata

After setting secrets, save the metadata via API:

```bash
POST /api/tenant/credentials/oauth
{
  "tenant_id": "abc123",
  "provider": "google",
  "credential_type": "individual",
  "client_id": "your-client-id",
  "client_secret": "your-client-secret",
  "redirect_uri": "https://your-domain.com/api/integrations/google-sheets/callback"
}
```

Or use the migration script:

```bash
tsx scripts/migrate-to-supabase-secrets.ts
```

## Credential Types

### Individual Credentials

Used for user-level OAuth flows (Google Drive, Dropbox personal accounts).

- Stored as: `credential_type: 'individual'`
- Used for: Personal file access, user-specific integrations
- Example: User connects their personal Google Drive

### Corporate Credentials

Used for company-level OAuth flows (Google Sheets corporate access, service accounts).

- Stored as: `credential_type: 'corporate'`
- Used for: Company-wide integrations, service account access
- Example: Company provides Google Service Account for automated Google Sheets export

## API Endpoints

### Get Tenant Credentials

```bash
GET /api/tenant/credentials/oauth?tenant_id={id}&provider=google&credential_type=individual
```

Returns credential metadata (without secret values).

### Save Tenant Credentials

```bash
POST /api/tenant/credentials/oauth
{
  "tenant_id": "abc123",
  "provider": "google",
  "credential_type": "individual",
  "client_id": "...",
  "client_secret": "...",
  "redirect_uri": "..."
}
```

**Note:** Secrets must be set via `supabase secrets set` before calling this endpoint.

### Delete Tenant Credentials

```bash
DELETE /api/tenant/credentials/oauth?tenant_id={id}&provider=google&credential_type=individual
```

Soft deletes credentials (sets `is_active = false`). Secrets in Supabase Secrets must be deleted separately.

### Test Tenant Credentials

```bash
POST /api/tenant/credentials/test
{
  "tenant_id": "abc123",
  "provider": "google",
  "credential_type": "individual"
}
```

Validates credential format and availability.

## Usage in Code

### Getting Credentials

```typescript
import { getCredentialManager } from "@/lib/credentials/VercelCredentialManager";

const credentialManager = getCredentialManager();

// Get best available Google OAuth (checks tenant first, then platform)
const oauthCreds = await credentialManager.getBestGoogleOAuth(tenantId);

// Get tenant-specific service account (corporate)
const serviceAccount = await credentialManager.getBestGoogleServiceAccount(tenantId);
```

### Credential Priority

The system checks credentials in this order:

1. **Tenant-specific corporate credentials** (if `credential_type: 'corporate'` requested)
2. **Tenant-specific individual credentials** (if `credential_type: 'individual'` requested)
3. **Platform credentials** (from Vercel env vars)

## Migration from Legacy Storage

If you have existing tenant credentials stored in:
- `tenant_integration_settings` table
- `tenant_settings` table

Run the migration script:

```bash
tsx scripts/migrate-to-supabase-secrets.ts
```

This will:
1. Read existing credentials from database
2. Set them in Supabase Secrets using proper naming convention
3. Save metadata to `tenant_oauth_credentials` table

## Listing Tenant Secrets

View all tenant credentials:

```bash
# List all tenant credentials
tsx scripts/list-tenant-secrets.ts

# List credentials for specific tenant
tsx scripts/list-tenant-secrets.ts {tenant_id}
```

Or use Supabase CLI:

```bash
supabase secrets list
```

## Security Considerations

1. **Secrets are encrypted at rest** by Supabase
2. **Edge Functions validate tenant access** before returning secrets
3. **RLS policies** prevent unauthorized access to credential metadata
4. **Service role required** for direct secret access
5. **Secrets never exposed** in API responses (only metadata)

## Troubleshooting

### "Secrets not found in Supabase Secrets Management"

**Cause:** Secrets haven't been set via `supabase secrets set`

**Solution:**
1. Set secrets using Supabase CLI
2. Verify with `supabase secrets list`
3. Retry the operation

### "Tenant not found"

**Cause:** Invalid tenant_id or user doesn't belong to tenant

**Solution:**
1. Verify tenant_id is correct
2. Check user's tenant_id in `users` table
3. Ensure RLS policies allow access

### "Edge Function error"

**Cause:** Edge Function not deployed or misconfigured

**Solution:**
1. Deploy Edge Functions: `supabase functions deploy get-tenant-credentials`
2. Verify Edge Function URL in `SupabaseCredentialManager`
3. Check Edge Function logs in Supabase Dashboard

### Fallback to Platform Credentials

If tenant-specific credentials aren't found, the system automatically falls back to platform credentials from Vercel env vars. This ensures the system continues to work even if tenant credentials aren't configured.

## Best Practices

1. **Always set secrets before saving metadata** - Use `supabase secrets set` before calling the API
2. **Use descriptive secret names** - Follow the naming convention exactly
3. **Test credentials after setup** - Use the `/api/tenant/credentials/test` endpoint
4. **Rotate secrets periodically** - Update secrets in Supabase Secrets and refresh metadata
5. **Monitor credential usage** - Check logs for credential access patterns
6. **Use corporate credentials for service accounts** - Store Google Service Account credentials as corporate type

## Related Files

- Database Schema: `supabase/migrations/20251228000000_create_tenant_oauth_credentials.sql`
- RPC Functions: `supabase/migrations/20251228000001_create_tenant_oauth_rpc_functions.sql`
- Edge Functions: `supabase/functions/get-tenant-credentials/`, `supabase/functions/set-tenant-credentials/`
- Credential Managers: `src/lib/credentials/VercelCredentialManager.ts`, `src/lib/credentials/SupabaseCredentialManager.ts`
- API Routes: `src/app/api/tenant/credentials/oauth/route.ts`
- Migration Scripts: `scripts/migrate-to-supabase-secrets.ts`, `scripts/list-tenant-secrets.ts`

