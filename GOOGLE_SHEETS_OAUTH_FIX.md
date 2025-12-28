# Google Sheets OAuth Redirect URI Mismatch Fix

## Problem

When trying to connect Google Sheets integration, you're getting the error:
```
Error 400: redirect_uri_mismatch
```

This happens when the redirect URI your application sends to Google doesn't match what's configured in your Google Cloud Console OAuth credentials.

## Solution

### Step 1: Determine Your Current Redirect URI

The Google Sheets integration uses the following redirect URI pattern:
```
{APP_URL}/api/integrations/google-sheets/callback
```

Where `{APP_URL}` is determined by:
1. `GOOGLE_REDIRECT_URI` environment variable (if set)
2. `NEXT_PUBLIC_APP_URL` environment variable (if set)
3. `VERCEL_URL` environment variable (if on Vercel)
4. Default: `http://localhost:3000` (for local development)

**To find out what redirect URI is being used:**
1. Check your server logs when initiating the OAuth flow
2. Look for the log line: `[Google Sheets OAuth] Redirect URI: ...`
3. Or check the response from `/api/integrations/google-sheets/auth-url` endpoint

### Step 2: Configure Redirect URI in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 Client ID (the one matching your `GOOGLE_CLIENT_ID`)
5. Click **Edit** (pencil icon)
6. Under **Authorized redirect URIs**, add:
   - **For local development:**
     ```
     http://localhost:3000/api/integrations/google-sheets/callback
     ```
   - **For production:**
     ```
     https://your-domain.com/api/integrations/google-sheets/callback
     ```
   - **For Vercel preview deployments:**
     ```
     https://your-preview-url.vercel.app/api/integrations/google-sheets/callback
     ```
7. Click **Save**

### Step 3: Set Environment Variables

Make sure your environment variables are set correctly:

**For Local Development (.env.local):**
```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
# OR explicitly set the redirect URI:
GOOGLE_REDIRECT_URI=http://localhost:3000/api/integrations/google-sheets/callback
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

**For Production (Vercel Environment Variables):**
```bash
NEXT_PUBLIC_APP_URL=https://your-domain.com
# OR explicitly set the redirect URI:
GOOGLE_REDIRECT_URI=https://your-domain.com/api/integrations/google-sheets/callback
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

### Step 4: Important Notes

1. **Exact Match Required**: The redirect URI must match EXACTLY, including:
   - Protocol (`http://` vs `https://`)
   - Domain (no trailing slashes)
   - Path (`/api/integrations/google-sheets/callback`)

2. **Multiple Environments**: If you're using the same OAuth credentials for multiple environments (local, staging, production), you need to add ALL redirect URIs to Google Cloud Console:
   ```
   http://localhost:3000/api/integrations/google-sheets/callback
   https://staging.your-domain.com/api/integrations/google-sheets/callback
   https://your-domain.com/api/integrations/google-sheets/callback
   ```

3. **Different from Google Drive**: Note that Google Sheets uses a different redirect URI path than Google Drive:
   - Google Sheets: `/api/integrations/google-sheets/callback`
   - Google Drive: `/api/storage/drive/callback`
   
   Make sure both are added to your OAuth credentials if you're using both integrations.

### Step 5: Verify Configuration

1. Check that your environment variables are set correctly
2. Verify the redirect URI in Google Cloud Console matches exactly
3. Try the OAuth flow again
4. Check server logs to confirm the redirect URI being used

### Troubleshooting

**Still getting redirect_uri_mismatch error?**

1. **Check the exact redirect URI in the error URL:**
   - Look at the Google error page URL
   - It will show what redirect URI was attempted
   - Compare it character-by-character with what's in Google Cloud Console

2. **Verify environment variables:**
   ```bash
   # In your terminal (for local dev)
   echo $NEXT_PUBLIC_APP_URL
   echo $GOOGLE_REDIRECT_URI
   ```

3. **Check for trailing slashes:**
   - `https://your-domain.com/api/integrations/google-sheets/callback` ✅
   - `https://your-domain.com/api/integrations/google-sheets/callback/` ❌

4. **Check protocol:**
   - Production must use `https://`
   - Local development can use `http://`

5. **Wait for propagation:**
   - Google Cloud Console changes can take a few minutes to propagate
   - Wait 2-3 minutes after saving before testing again

### Quick Reference

**Default Redirect URI Construction:**
```typescript
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
const redirectUri = process.env.GOOGLE_REDIRECT_URI || 
  `${baseUrl}/api/integrations/google-sheets/callback`
```

**Required Scopes:**
- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/userinfo.email`

Make sure these scopes are enabled in your Google Cloud project.



