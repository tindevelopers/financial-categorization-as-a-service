# Google Sheets OAuth Invalid Client Error Diagnosis

## Test Results from Localhost Browser Testing

### Test Date
December 27, 2025

### Test Environment
- **Portal App URL**: http://localhost:3002
- **OAuth Connect Endpoint**: `/api/integrations/google-sheets/connect`
- **Callback Endpoint**: `/api/integrations/google-sheets/callback`

### Configuration Found

#### Environment Variables (.env.local)
```bash
GOOGLE_CLIENT_ID=1059004568296-mj9ftg4d5ehsa9pjrk586ukpqnb78fng.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_SHEETS_REDIRECT_URI=http://localhost:3002/api/integrations/google-sheets/callback
```

#### OAuth Flow Tested
1. ✅ Navigated to `/dashboard/integrations/google-sheets`
2. ✅ Clicked "Connect with Google" button
3. ✅ Preflight redirect page shown (expected in development)
4. ✅ Redirected to Google OAuth consent page
5. ⚠️ **Potential Issue**: `invalid_client` error would occur if:
   - Redirect URI doesn't match Google Cloud Console configuration
   - Client ID doesn't exist or is incorrect
   - Client Secret is wrong

### Expected Redirect URI
```
http://localhost:3002/api/integrations/google-sheets/callback
```

### OAuth URL Generated
The connect route generates an OAuth URL with:
- **Client ID**: `1059004568296-mj9ftg4d5ehsa9pjrk586ukpqnb78fng.apps.googleusercontent.com`
- **Redirect URI**: `http://localhost:3002/api/integrations/google-sheets/callback`
- **Scopes**: 
  - `https://www.googleapis.com/auth/spreadsheets`
  - `https://www.googleapis.com/auth/drive.readonly`
  - `https://www.googleapis.com/auth/userinfo.email`

## Common Causes of `invalid_client` Error

### 1. Redirect URI Mismatch (Most Common)
**Symptom**: Google returns `invalid_client` or `redirect_uri_mismatch`

**Solution**:
1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Find your OAuth 2.0 Client ID: `1059004568296-mj9ftg4d5ehsa9pjrk586ukpqnb78fng.apps.googleusercontent.com`
3. Click "Edit"
4. Under "Authorized redirect URIs", ensure this exact URI is listed:
   ```
   http://localhost:3002/api/integrations/google-sheets/callback
   ```
5. **Important**: No trailing slashes, exact match required
6. Save changes
7. Wait 1-2 minutes for changes to propagate
8. Try connecting again

### 2. Client ID Doesn't Exist
**Symptom**: `invalid_client` error immediately

**Solution**:
- Verify the Client ID exists in Google Cloud Console
- Check that it's an OAuth 2.0 Client ID (not Service Account)
- Ensure it's in the correct Google Cloud project

### 3. Client Secret Mismatch
**Symptom**: `invalid_client` during token exchange (after authorization)

**Solution**:
- Verify the Client Secret in `.env.local` matches Google Cloud Console
- Regenerate the secret if needed (old secret will stop working)
- Update `.env.local` with the new secret
- Restart the dev server

### 4. OAuth App Not Configured
**Symptom**: `invalid_client` or `configuration_error`

**Solution**:
- Ensure OAuth consent screen is configured
- Add test users if app is in testing mode
- Complete app verification if required

## Error Handling in Code

The application has comprehensive error handling:

### Callback Route (`apps/portal/app/api/integrations/google-sheets/callback/route.ts`)
- Handles OAuth errors from Google (lines 73-100)
- Provides detailed error messages with guidance
- Logs configuration details for debugging

### Error Guidance (`apps/portal/lib/google-sheets/oauth-config.ts`)
- `getOAuthErrorGuidance()` function provides actionable steps for each error type
- `invalid_client` guidance includes:
  - Verify credentials in Supabase Secrets or Vercel
  - Check Client ID and Secret match Google Cloud Console
  - Contact administrator if credentials need updating

## Debugging Steps

### 1. Check Server Logs
When testing locally, check the terminal running `npm run dev` for:
- OAuth configuration logs
- Redirect URI values
- Client ID prefixes (first 20 chars)
- Any error messages

### 2. Verify Google Cloud Console
1. Navigate to: https://console.cloud.google.com/apis/credentials
2. Find Client ID: `1059004568296-mj9ftg4d5ehsa9pjrk586ukpqnb78fng`
3. Check:
   - ✅ Application type: "Web application"
   - ✅ Authorized redirect URIs includes: `http://localhost:3002/api/integrations/google-sheets/callback`
   - ✅ Client Secret matches `.env.local`

### 3. Test OAuth Flow
1. Navigate to: http://localhost:3002/dashboard/integrations/google-sheets
2. Click "Connect with Google"
3. If preflight page appears, click "Continue anyway"
4. Complete Google sign-in
5. Check for error messages

### 4. Check Network Requests
In browser DevTools → Network tab, look for:
- `/api/integrations/google-sheets/connect` - Should redirect to Google
- `/api/integrations/google-sheets/callback` - Should receive authorization code
- Error parameters in callback URL if OAuth fails

## Code Locations

### Key Files
- **Connect Route**: `apps/portal/app/api/integrations/google-sheets/connect/route.ts`
- **Callback Route**: `apps/portal/app/api/integrations/google-sheets/callback/route.ts`
- **Auth URL Route**: `apps/portal/app/api/integrations/google-sheets/auth-url/route.ts`
- **OAuth Config**: `apps/portal/lib/google-sheets/oauth-config.ts`
- **UI Page**: `apps/portal/app/dashboard/integrations/google-sheets/page.tsx`

### Credential Management
- **Credential Manager**: `apps/portal/lib/credentials/VercelCredentialManager.ts`
- Checks tenant-specific credentials first, then platform-level

## Next Steps

1. **Verify Google Cloud Console Configuration**
   - Ensure redirect URI is exactly: `http://localhost:3002/api/integrations/google-sheets/callback`
   - No trailing slashes or extra characters

2. **Test with Force Parameter**
   - Navigate to: `http://localhost:3002/api/integrations/google-sheets/connect?force=1`
   - This bypasses the preflight check

3. **Check Environment Variables**
   - Verify `.env.local` has correct values
   - Restart dev server after changes

4. **Review Server Logs**
   - Look for OAuth configuration logs
   - Check for any error messages during token exchange

5. **Test Token Exchange**
   - If authorization succeeds but token exchange fails, check Client Secret
   - Verify redirect URI matches exactly between authorize and token exchange

## Additional Notes

- The application includes extensive logging for OAuth debugging
- Error messages include actionable guidance for users
- Preflight checks in development help prevent common configuration errors
- Redirect URI is computed from request origin to avoid port/env drift



