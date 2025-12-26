# Google Sheets Integration Setup - Complete ✅

## Environment Variables Configured

All required environment variables have been set in Vercel for all environments:

### Production (`https://fincat.tinconnect.com`)
- ✅ `GOOGLE_CLIENT_ID` - Set
- ✅ `GOOGLE_CLIENT_SECRET` - Set  
- ✅ `GOOGLE_SHEETS_REDIRECT_URI` - `https://fincat.tinconnect.com/api/integrations/google-sheets/callback`
- ✅ `NEXT_PUBLIC_APP_URL` - Set
- ✅ `ENCRYPTION_KEY` - Set

### Preview
- ✅ `GOOGLE_CLIENT_ID` - Set
- ✅ `GOOGLE_CLIENT_SECRET` - Set
- ✅ `GOOGLE_SHEETS_REDIRECT_URI` - Set
- ✅ `ENCRYPTION_KEY` - Set

### Development
- ✅ `GOOGLE_CLIENT_ID` - Set
- ✅ `GOOGLE_CLIENT_SECRET` - Set
- ✅ `GOOGLE_SHEETS_REDIRECT_URI` - `http://localhost:3000/api/integrations/google-sheets/callback`
- ✅ `ENCRYPTION_KEY` - Set

## OAuth Redirect URI

**Production Redirect URI:**
```
https://fincat.tinconnect.com/api/integrations/google-sheets/callback
```

**⚠️ IMPORTANT:** Make sure this exact redirect URI is added to your Google Cloud Console OAuth 2.0 Client ID settings:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your project
3. Find your OAuth 2.0 Client ID
4. Click **Edit**
5. Under **Authorized redirect URIs**, add:
   ```
   https://fincat.tinconnect.com/api/integrations/google-sheets/callback
   ```
6. Click **Save**

## Testing the Integration

### Option 1: Test on Production
1. Visit: `https://fincat.tinconnect.com/dashboard/integrations/google-sheets`
2. Click **"Connect with Google"**
3. Complete the OAuth flow
4. You should be redirected back and see "Connected to Google Sheets"

### Option 2: Test Locally
1. Make sure your local `.env.local` has:
   ```env
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ENCRYPTION_KEY=your-32-byte-hex-key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```
2. Start the dev server: `npm run dev`
3. Visit: `http://localhost:3000/dashboard/integrations/google-sheets`
4. Click **"Connect with Google"**

### Option 3: Test via Settings Page
1. Visit: `https://fincat.tinconnect.com/dashboard/settings`
2. Scroll to **Integrations** section
3. Click **"Connect Google Account"** (redirects to integrations page)

## What Was Created

### API Routes
- ✅ `/api/integrations/google-sheets/connect` - Initiates OAuth flow
- ✅ `/api/integrations/google-sheets/callback` - Handles OAuth callback
- ✅ `/api/integrations/google-sheets/disconnect` - Disconnects integration
- ✅ `/api/integrations/google-sheets/list` - Lists available spreadsheets (updated to use OAuth)

### Pages
- ✅ `/dashboard/integrations/google-sheets` - Main integration management page
- ✅ `/dashboard/settings/spreadsheets` - Updated with connection link

## Features

- ✅ OAuth 2.0 authentication flow
- ✅ Secure token encryption and storage
- ✅ Connection status display
- ✅ Disconnect functionality
- ✅ Automatic token refresh
- ✅ List available Google Sheets
- ✅ View spreadsheet details and tabs

## Troubleshooting

### "redirect_uri_mismatch" Error
- Verify the redirect URI in Google Cloud Console matches exactly
- Check that `GOOGLE_SHEETS_REDIRECT_URI` is set correctly in Vercel
- Wait 2-3 minutes after updating Google Cloud Console settings

### "Not configured" Error
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in Vercel
- Check that `ENCRYPTION_KEY` is set (32-byte hex string)

### Token Refresh Issues
- Verify `ENCRYPTION_KEY` hasn't changed (would invalidate stored tokens)
- User may need to reconnect if tokens are corrupted

## Next Steps

1. ✅ Verify redirect URI in Google Cloud Console
2. ✅ Test OAuth flow on production
3. ✅ Verify tokens are stored correctly
4. ✅ Test listing spreadsheets
5. ✅ Test disconnect functionality

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Ensure redirect URI matches exactly in Google Cloud Console

