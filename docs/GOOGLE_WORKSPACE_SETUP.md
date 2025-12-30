# Google Workspace Setup Guide

This guide covers setting up Google OAuth for Google Sheets integration, including support for Google Workspace admin accounts.

## Table of Contents

1. [OAuth App Setup](#oauth-app-setup)
2. [Redirect URI Configuration](#redirect-uri-configuration)
3. [Google Workspace Domain-Wide Delegation](#google-workspace-domain-wide-delegation)
4. [Troubleshooting Common Errors](#troubleshooting-common-errors)
5. [Account Management](#account-management)

## OAuth App Setup

### Step 1: Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your project (or create a new one)
3. Click **"Create Credentials"** > **"OAuth client ID"**
4. If prompted, configure the OAuth consent screen:
   - Choose **"External"** (unless you have a Google Workspace account)
   - Fill in required fields:
     - App name: Your application name
     - User support email: Your email
     - Developer contact: Your email
   - Click **"Save and Continue"**
   - Add scopes:
     - `https://www.googleapis.com/auth/spreadsheets`
     - `https://www.googleapis.com/auth/drive.readonly`
     - `https://www.googleapis.com/auth/userinfo.email`
   - Add test users (if in testing mode)
   - Click **"Save and Continue"**

### Step 2: Configure OAuth Client

1. Application type: Select **"Web application"**
2. Name: Give it a descriptive name (e.g., "Financial Categorization - Google Sheets")
3. **Authorized redirect URIs**: Add your redirect URI(s):
   ```
   https://your-domain.com/api/integrations/google-sheets/callback
   ```
   For local development:
   ```
   http://localhost:3000/api/integrations/google-sheets/callback
   ```
4. Click **"Create"**
5. Copy the **Client ID** and **Client Secret**

### Step 3: Configure Credentials

#### Option A: Tenant-Specific Credentials (Recommended)

Store credentials in Supabase Secrets for tenant-specific OAuth:

```bash
# Set tenant OAuth credentials
supabase secrets set --project-ref YOUR_PROJECT_REF \
  "TENANT_{TENANT_ID}_GOOGLE_INDIVIDUAL_CLIENT_ID=your-client-id" \
  "TENANT_{TENANT_ID}_GOOGLE_INDIVIDUAL_CLIENT_SECRET=your-client-secret"
```

#### Option B: Platform-Level Credentials

Store credentials in Vercel environment variables:

```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_SHEETS_REDIRECT_URI=https://your-domain.com/api/integrations/google-sheets/callback
```

## Redirect URI Configuration

The redirect URI must **exactly match** what's configured in Google Cloud Console.

### Expected Redirect URI Format

```
https://your-domain.com/api/integrations/google-sheets/callback
```

### Common Issues

1. **Trailing Slash**: Don't include a trailing slash
2. **HTTP vs HTTPS**: Use HTTPS in production
3. **Case Sensitivity**: URLs are case-sensitive
4. **Port Numbers**: Include port for local development (e.g., `:3000`)

### Verification

The system automatically validates redirect URIs. If there's a mismatch, you'll see:
- Error: "redirect_uri_mismatch"
- Guidance with the exact URI that should be configured

## Google Workspace Domain-Wide Delegation

For Google Workspace admin accounts, you can set up domain-wide delegation to access all users' spreadsheets.

### Prerequisites

- Google Workspace admin account
- Service account with domain-wide delegation enabled
- Admin API enabled in Google Cloud Console

### Step 1: Create Service Account

1. Go to [Google Cloud Console > IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Click **"Create Service Account"**
3. Fill in details:
   - Name: e.g., "Financial Categorization Service"
   - Description: "Service account for Google Sheets integration"
4. Click **"Create and Continue"**
5. Skip role assignment (click **"Continue"**)
6. Click **"Done"**

### Step 2: Enable Domain-Wide Delegation

1. Click on the service account you just created
2. Go to **"Details"** tab
3. Check **"Enable Google Workspace Domain-wide Delegation"**
4. Note the **Client ID** (you'll need this for Workspace Admin)

### Step 3: Configure in Google Workspace Admin

1. Go to [Google Admin Console](https://admin.google.com)
2. Navigate to **Security** > **API Controls** > **Domain-wide Delegation**
3. Click **"Add new"**
4. Enter:
   - Client ID: The service account Client ID from Step 2
   - OAuth Scopes (comma-separated):
     ```
     https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive
     ```
5. Click **"Authorize"**

### Step 4: Configure Service Account Credentials

Store the service account credentials:

#### For Tenant-Specific (Recommended)

```bash
supabase secrets set --project-ref YOUR_PROJECT_REF \
  "TENANT_{TENANT_ID}_GOOGLE_CORPORATE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com" \
  "TENANT_{TENANT_ID}_GOOGLE_CORPORATE_SERVICE_ACCOUNT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

#### For Platform-Level

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

**Note**: The private key should include literal `\n` characters (not actual newlines).

## Troubleshooting Common Errors

### Error 400: invalid_request

**Cause**: OAuth app doesn't comply with Google's policies or redirect URI mismatch.

**Solutions**:
1. Verify redirect URI matches exactly in Google Cloud Console
2. Check OAuth consent screen is configured
3. Ensure app is verified (if required)
4. For testing, add test users in OAuth consent screen

**Action Steps**:
1. Go to [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your OAuth 2.0 Client ID
3. Verify redirect URI matches: `https://your-domain.com/api/integrations/google-sheets/callback`
4. Check OAuth consent screen configuration

### Error: redirect_uri_mismatch

**Cause**: The redirect URI in the request doesn't match any authorized redirect URIs.

**Solutions**:
1. Add the exact redirect URI to Google Cloud Console
2. Remove trailing slashes
3. Use HTTPS in production
4. Wait a few minutes after updating (Google caches redirect URIs)

**Expected Redirect URI**:
```
https://your-domain.com/api/integrations/google-sheets/callback
```

### Error: access_denied

**Cause**: User denied access or OAuth app needs verification.

**Solutions**:
1. User needs to click "Allow" when prompted
2. If app is unverified, add test users in OAuth consent screen
3. For production, submit app for verification

### Error: invalid_client

**Cause**: Client ID or secret is incorrect or not configured.

**Solutions**:
1. Verify credentials are correctly set in Supabase Secrets or Vercel
2. Check for typos in Client ID or Secret
3. Ensure credentials match Google Cloud Console
4. For tenant-specific credentials, verify tenant ID format

### App Verification Required

If you see "Access blocked: Authorization Error", your app may need verification:

1. Go to [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
2. Complete all required fields
3. Add test users (for testing without verification)
4. Submit for verification (for production use)

**Test Users**:
- Add user emails in "Test users" section
- Only test users can use the app until verified
- Verification required for apps with >100 users or sensitive scopes

## Account Management

### Connecting Your Google Account

1. Go to **Settings > Integrations > Google Sheets**
2. Click **"Connect with Google"**
3. Sign in with your Google account
4. Grant requested permissions
5. You'll be redirected back to the integration page

### Switching Accounts

1. Go to **Settings > Integrations > Google Sheets**
2. Click **"Switch Account"**
3. Confirm disconnection
4. Connect with a different Google account

### Disconnecting

1. Go to **Settings > Integrations > Google Sheets**
2. Click **"Disconnect"**
3. Confirm disconnection
4. Your tokens will be removed

### Workspace Admin Accounts

If you connect with a Google Workspace account (not @gmail.com), the system will:
- Automatically detect it's a Workspace account
- Store the workspace domain
- Prioritize Workspace admin authentication when available
- Use domain-wide delegation if configured

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use Supabase Secrets** for tenant-specific credentials
3. **Rotate credentials** periodically
4. **Limit OAuth scopes** to minimum required
5. **Use HTTPS** in production
6. **Enable 2FA** on Google accounts used for OAuth
7. **Monitor OAuth usage** in Google Cloud Console

## Support

If you encounter issues not covered in this guide:

1. Check the error message in the integration page
2. Review Google Cloud Console logs
3. Verify credentials are correctly configured
4. Check OAuth consent screen status
5. Contact support with:
   - Error message
   - Steps to reproduce
   - Screenshot of error (if applicable)

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Workspace Domain-Wide Delegation](https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority)
- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [OAuth App Verification](https://support.google.com/cloud/answer/9110914)

