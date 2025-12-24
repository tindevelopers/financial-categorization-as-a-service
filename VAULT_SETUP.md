# Supabase Vault Setup Guide

This guide explains how to set up secure secrets storage using Supabase Vault for storing OAuth credentials and API keys.

## Overview

The application uses a two-tier encryption approach:

1. **Supabase Vault (Primary)** - Database-level encryption using pgsodium
2. **Application Encryption (Fallback)** - AES-256-GCM encryption for environments where Vault is not available

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Settings Page                                │
│                    (Client ID + Secret input)                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ HTTPS
┌─────────────────────────────────────────────────────────────────────┐
│                    tenant-settings API                               │
│                                                                      │
│   ┌─────────────┐     ┌─────────────────┐                           │
│   │ Check Vault │ ──► │ vault.create_   │ ──► Vault Available?      │
│   │ Available   │     │ secret() RPC    │           │               │
│   └─────────────┘     └─────────────────┘           │               │
│                                                      ▼               │
│                       ┌─────────────────────────────────────────┐   │
│                       │  Yes: Store in vault.secrets table      │   │
│                       │       with pgsodium encryption          │   │
│                       │                                         │   │
│                       │  No:  Use ENCRYPTION_KEY to encrypt     │   │
│                       │       and store in settings table       │   │
│                       └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Supabase Database                            │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                      vault.secrets                           │   │
│   │  ┌──────────┬──────────┬──────────┬─────────┬─────────────┐ │   │
│   │  │    id    │   name   │  secret  │ key_id  │    nonce    │ │   │
│   │  │  (UUID)  │  (TEXT)  │(ENCRYPTED│ (UUID)  │   (BYTEA)   │ │   │
│   │  │          │          │  BASE64) │         │             │ │   │
│   │  └──────────┴──────────┴──────────┴─────────┴─────────────┘ │   │
│   │                            ▲                                 │   │
│   │                            │ pgsodium encryption             │   │
│   │                            │                                 │   │
│   │  ┌─────────────────────────────────────────────────────────┐ │   │
│   │  │                    pgsodium.key                          │ │   │
│   │  │  (Encryption keys stored securely in database)          │ │   │
│   │  └─────────────────────────────────────────────────────────┘ │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Setup Instructions

### 1. Run Database Migrations

The vault tables and functions are created by the migrations:

```bash
# Push migrations to Supabase
npx supabase db push

# Or run specific migrations
npx supabase migration up
```

Key migrations:
- `20251224100000_enable_vault.sql` - Creates vault schema and functions
- `20251224100001_update_tenant_settings_for_vault.sql` - Adds vault reference columns

### 2. Configure Environment Variables

#### For Supabase Vault (Recommended)

Supabase manages the pgsodium root key automatically in production. No additional configuration is needed if you're using Supabase Cloud.

For local development with Supabase CLI:

```bash
# The key is managed automatically, but you can check it in config.toml
# [db.vault]
# enabled = true
```

#### For Application-Level Encryption (Fallback)

If Vault is not available, the application falls back to AES-256-GCM encryption. You must set the `ENCRYPTION_KEY` environment variable.

**Generate a secure key:**

```bash
# Generate a 32-byte hex key (64 characters)
openssl rand -hex 32
```

**Add to Vercel:**

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add the following variable:

| Name | Value | Environment |
|------|-------|-------------|
| `ENCRYPTION_KEY` | `<your-64-char-hex-key>` | Production, Preview, Development |

**Add to local `.env.local`:**

```bash
# .env.local
ENCRYPTION_KEY=your_64_character_hex_key_here_generated_with_openssl_rand
```

### 3. Verify Setup

After deployment, verify the setup by:

1. Go to Settings → Integrations → Google Sheets
2. Enable "Custom OAuth Credentials"
3. Enter test credentials
4. Click "Test Credentials" - should pass validation
5. Click "Save Credentials"
6. Check Vercel logs for: `[Tenant Settings] Vault available: true` or `[Tenant Settings] Using encryption fallback`

### 4. Migrate Existing Secrets (Optional)

If you have existing encrypted secrets that need to be migrated to Vault:

```sql
-- Connect to your Supabase database
-- Run the migration function
SELECT migrate_secrets_to_vault();
```

## Security Features

### Vault Encryption (pgsodium)

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Management**: Per-secret unique keys stored in `pgsodium.key`
- **Nonce**: Random nonce per secret for uniqueness
- **Access Control**: Only service role can access `vault.secrets` directly
- **Key Rotation**: Supported via SQL functions

### Fallback Encryption (Application-Level)

- **Algorithm**: AES-256-GCM
- **Key**: Derived from `ENCRYPTION_KEY` environment variable
- **IV**: Random 16-byte IV per encryption
- **Auth Tag**: 16-byte authentication tag for integrity

### Row Level Security

- `vault.secrets` table has RLS enabled
- Only `service_role` can access secrets directly
- Users must use the `get_integration_secret()` RPC function
- The RPC function runs with `SECURITY DEFINER` privileges

## Troubleshooting

### "Vault not available" in logs

The application falls back to encryption. This is normal for:
- Local development without full Supabase setup
- Supabase plans without pgsodium enabled

Solution: Ensure `ENCRYPTION_KEY` is set in environment variables.

### "ENCRYPTION_KEY environment variable is not set"

Add the key to your environment:

```bash
# Vercel
vercel env add ENCRYPTION_KEY

# Local
echo 'ENCRYPTION_KEY=your_key_here' >> .env.local
```

### "Failed to decrypt client secret"

The stored secret was encrypted with a different key than what's currently configured.

Solutions:
1. Ensure `ENCRYPTION_KEY` matches what was used to encrypt
2. Re-save the credentials with the current key
3. Check if secrets were migrated to Vault (check `client_secret_vault_id` column)

### "pgsodium functions not available"

Some Supabase plans may not include pgsodium. The migration handles this gracefully by falling back to base64 encoding with a warning.

For full security, use application-level encryption by setting `ENCRYPTION_KEY`.

## Best Practices

1. **Never commit encryption keys** - Always use environment variables
2. **Rotate keys periodically** - Use Vault's key rotation features
3. **Monitor access** - Check Supabase logs for vault access
4. **Backup keys securely** - Store `ENCRYPTION_KEY` in a password manager
5. **Use different keys per environment** - Production, staging, and development should have different keys

