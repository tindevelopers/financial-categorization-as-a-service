# Google Sheets "Unauthorized" Error - SOLUTION ✅

## Problem

The "Available Spreadsheets" page shows:
```
Error
Unauthorized. Please sign in and try again.
```

## Root Cause

The Google OAuth tokens stored in the database were created with the **production redirect URI**:
```
https://fincat.develop.tinconnect.com/api/integrations/google-sheets/callback
```

But now you're running **locally** with a different redirect URI:
```
http://localhost:3080/api/integrations/google-sheets/callback
```

### Why This Causes 401 Unauthorized

Google OAuth requires the **redirect URI to match exactly** when:
- Creating tokens (during OAuth flow)
- Refreshing tokens (when they expire)

When the redirect URIs don't match, Google's OAuth API rejects the token refresh with a 401 Unauthorized error.

### Evidence from Logs

```
redirectUri: 'https://fincat.develop.tinconnect.com/api/integrations/google-sheets/callback'
...
Token refresh failed
GET /api/integrations/google-sheets/list 401 in 8568ms
```

The token refresh is failing because:
1. The stored refresh token was created with production redirect URI
2. The code is trying to refresh it with localhost redirect URI
3. Google rejects this as a redirect URI mismatch

## Solution

### Option 1: Reconnect Google Sheets in Localhost (RECOMMENDED)

Since you're testing locally, you need to create a fresh OAuth connection with the localhost redirect URI:

#### Steps:

1. **Go to Settings → Integrations**
   - URL: http://localhost:3080/dashboard/settings

2. **Find "Google Sheets" integration**
   - Click "Connect Google Account" or "Reconnect"

3. **Authorize with Google**
   - This will create new tokens with localhost redirect URI
   - Grant access to Google Sheets and Google Drive

4. **Return to Spreadsheets page**
   - URL: http://localhost:3080/dashboard/settings/spreadsheets
   - Should now show your spreadsheets

### Option 2: Use Production Environment

If you need to test with existing production data, use the production environment:
```
https://fincat.develop.tinconnect.com/dashboard/settings/spreadsheets
```

The production tokens will work there since the redirect URI matches.

### Option 3: Disconnect and Reconnect via Database

If the UI doesn't have a disconnect button, you can manually clear the connection:

```sql
-- Find the user's connection
SELECT * FROM cloud_storage_connections 
WHERE user_id = 'YOUR_USER_ID' 
AND provider = 'google_sheets';

-- Delete it
DELETE FROM cloud_storage_connections 
WHERE user_id = 'YOUR_USER_ID' 
AND provider = 'google_sheets';

-- Also check user_integrations table
DELETE FROM user_integrations 
WHERE user_id = 'YOUR_USER_ID' 
AND provider = 'google_sheets';
```

Then reconnect through the UI.

## Technical Details

### OAuth Redirect URI Configuration

The redirect URI is determined by:

1. **Production (Vercel):**
   - From env var: `GOOGLE_SHEETS_REDIRECT_URI`
   - Value: `https://fincat.develop.tinconnect.com/api/integrations/google-sheets/callback`

2. **Local Development:**
   - Computed from request origin: `http://localhost:3080/api/integrations/google-sheets/callback`

### Why This Affects Token Refresh

When Google OAuth tokens are created:
- Google stores the redirect URI with the token
- Future token refreshes **must use the same redirect URI**
- Mismatch = 401 Unauthorized

### Files Involved

1. **`apps/portal/app/api/integrations/google-sheets/list/route.ts`**
   - Line 28: Calls `createTenantGoogleClientsForRequestUser()` (business tier)
   - Line 112-163: Falls back to consumer OAuth path
   - Both paths attempt token refresh if expired

2. **`apps/portal/lib/google-sheets/tenant-clients.ts`**
   - Line 109: Calls `refreshOAuthToken()` if token expired

3. **`apps/portal/lib/google-sheets/auth-helpers.ts`**
   - Line 181: `await oauth2Client.refreshAccessToken()` - THIS IS WHERE IT FAILS
   - Google rejects the refresh due to redirect URI mismatch

## Recommended Next Steps

### For Local Development Testing

1. **Clear existing connection** (if disconnect button available)
2. **Connect Google Sheets** at http://localhost:3080/dashboard/settings
3. **Authorize with your Google account**
4. **Test spreadsheets page** at http://localhost:3080/dashboard/settings/spreadsheets

### For Production Testing

Keep using the production environment where the OAuth tokens are valid:
- Production URL: https://fincat.develop.tinconnect.com

### Alternative: Update .env.local

If you want to use production tokens in localhost, you could temporarily update `.env.local`:

```bash
# Temporarily use production redirect URI for local testing
GOOGLE_SHEETS_REDIRECT_URI="https://fincat.develop.tinconnect.com/api/integrations/google-sheets/callback"
NEXT_PUBLIC_APP_URL="https://fincat.develop.tinconnect.com"
```

But this is **NOT RECOMMENDED** because:
- OAuth callbacks will go to production, not localhost
- You won't be able to complete new OAuth flows locally
- It's a workaround, not a proper fix

## Best Practice

For local development:
- ✅ **Always reconnect OAuth integrations** when switching between environments
- ✅ **Use separate Google OAuth apps** for dev and production (optional but recommended)
- ✅ **Test OAuth flows end-to-end** in the environment where they'll be used

---

## ✅ Quick Fix

**Go to:** http://localhost:3080/dashboard/settings

**Find:** Google Sheets integration

**Click:** "Connect Google Account" (or "Reconnect" if shown)

**Authorize:** Grant access to your Google account

**Done:** Spreadsheets page should now work! 🎉
