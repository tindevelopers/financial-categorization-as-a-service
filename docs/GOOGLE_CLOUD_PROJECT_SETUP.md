# Google Cloud Project Setup Guide

This guide covers setting up **both OAuth 2.0 Client ID and Service Account** in the **same Google Cloud project** for Google Sheets integration.

## Overview

Your Google Cloud project should contain:
1. **OAuth 2.0 Client ID** - For user-level OAuth authentication (individual users connecting their Google accounts)
2. **Service Account** - For server-side access and Google Workspace domain-wide delegation (corporate accounts)

Both credentials are created in the **same Google Cloud project** and share the same APIs and configuration.

## Prerequisites

- Google Cloud account
- Access to [Google Cloud Console](https://console.cloud.google.com/)
- (Optional) Google Workspace admin access (for domain-wide delegation)

## Step-by-Step Setup

### Step 1: Create or Select Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top
3. Either:
   - **Select an existing project**, OR
   - **Create a new project**:
     - Click "New Project"
     - Enter project name (e.g., "Financial Categorization")
     - Click "Create"
     - Wait for project creation to complete

**Important**: All credentials (OAuth client and service account) will be created in this same project.

### Step 2: Enable Required APIs

1. In your project, go to **"APIs & Services" > "Library"**
2. Enable the following APIs:
   - **Google Sheets API**
   - **Google Drive API** (if using Google Drive integration)
   - **Admin SDK API** (only if using Google Workspace domain-wide delegation)

To enable an API:
- Search for the API name
- Click on it
- Click **"Enable"**

### Step 3: Configure OAuth Consent Screen

**This step is required before creating OAuth credentials.**

1. Go to **"APIs & Services" > "OAuth consent screen"**
2. Choose user type:
   - **External** (for most use cases)
   - **Internal** (only if you have a Google Workspace organization)
3. Fill in required fields:
   - **App name**: Your application name (e.g., "Financial Categorization")
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click **"Save and Continue"**
5. **Add Scopes** (click "Add or Remove Scopes"):
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.readonly` (if using Google Drive)
   - `https://www.googleapis.com/auth/userinfo.email`
   - Click **"Update"** then **"Save and Continue"**
6. **Add Test Users** (if app is in testing mode):
   - Add email addresses of users who will test the integration
   - Click **"Save and Continue"**
7. Review and click **"Back to Dashboard"**

**Note**: For production use with >100 users, you'll need to submit your app for verification.

### Step 4: Create OAuth 2.0 Client ID

**This is for user-level OAuth authentication.**

1. Go to **"APIs & Services" > "Credentials"**
2. Click **"+ CREATE CREDENTIALS"** > **"OAuth client ID"**
3. If prompted, select **"Web application"** as the application type
4. Fill in the form:
   - **Name**: e.g., "Financial Categorization - Google Sheets OAuth"
   - **Authorized JavaScript origins**: (Optional, leave blank for server-side OAuth)
   - **Authorized redirect URIs**: Add your redirect URIs:
     ```
     https://your-domain.com/api/integrations/google-sheets/callback
     ```
     For local development:
     ```
     http://localhost:3002/api/integrations/google-sheets/callback
     ```
     **Important**: Add all environments you'll use (production, staging, local)
5. Click **"Create"**
6. **Copy the credentials**:
   - **Client ID**: Copy this value
   - **Client Secret**: Copy this value (click "Show" if hidden)
   - **Save these securely** - you'll need them for configuration

**Security Note**: Never commit these credentials to version control. Store them in:
- Supabase Secrets (for tenant-specific credentials)
- Vercel Environment Variables (for platform-level credentials)

### Step 5: Create Service Account

**This is for server-side access and Google Workspace domain-wide delegation.**

1. Still in the **same Google Cloud project**, go to **"IAM & Admin" > "Service Accounts"**
2. Click **"+ CREATE SERVICE ACCOUNT"**
3. Fill in service account details:
   - **Service account name**: e.g., "financial-categorization-service"
   - **Service account ID**: Auto-generated (can be customized)
   - **Description**: e.g., "Service account for Google Sheets integration and domain-wide delegation"
4. Click **"Create and Continue"**
5. **Grant roles** (optional for basic usage):
   - You can skip this step for now (click **"Continue"**)
   - Roles are typically not needed if using domain-wide delegation
6. Click **"Done"**

### Step 6: Create Service Account Key

1. Click on the service account you just created
2. Go to the **"Keys"** tab
3. Click **"Add Key"** > **"Create new key"**
4. Select **"JSON"** as the key type
5. Click **"Create"**
6. **Download the JSON file** - it will be automatically downloaded
7. **Keep this file secure** - it contains sensitive credentials

**Important**: This JSON file contains:
- `client_email`: The service account email (e.g., `service-account@project-id.iam.gserviceaccount.com`)
- `private_key`: The private key (used for authentication)
- `project_id`: Your Google Cloud project ID

### Step 7: Enable Domain-Wide Delegation (Optional - for Google Workspace)

**Only needed if you want to use Google Workspace domain-wide delegation.**

1. Still in the service account details page, go to the **"Details"** tab
2. Check the box: **"Enable Google Workspace Domain-wide Delegation"**
3. Note the **"Client ID"** shown (you'll need this for Workspace Admin)
4. Click **"Save"**

### Step 8: Configure Domain-Wide Delegation in Google Workspace Admin

**Only if you enabled domain-wide delegation in Step 7.**

1. Go to [Google Admin Console](https://admin.google.com)
2. Navigate to **"Security" > "API Controls" > "Domain-wide Delegation"**
3. Click **"Add new"**
4. Enter:
   - **Client ID**: The service account Client ID from Step 7
   - **OAuth Scopes** (comma-separated):
     ```
     https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive.readonly
     ```
5. Click **"Authorize"**

## Configuration Summary

After completing these steps, you should have:

### OAuth 2.0 Client Credentials
- **Client ID**: `xxxxx.apps.googleusercontent.com`
- **Client Secret**: `GOCSPX-xxxxx`
- **Redirect URI**: `https://your-domain.com/api/integrations/google-sheets/callback`

### Service Account Credentials
- **Service Account Email**: `service-account@project-id.iam.gserviceaccount.com`
- **Private Key**: From the downloaded JSON file
- **Client ID** (for domain-wide delegation): `xxxxx` (if enabled)

## Storing Credentials

### Option A: Tenant-Specific Credentials (Recommended)

Store credentials in Supabase Secrets for each tenant:

```bash
# OAuth Client Credentials
supabase secrets set --project-ref YOUR_PROJECT_REF \
  "TENANT_{TENANT_ID}_GOOGLE_INDIVIDUAL_CLIENT_ID=your-client-id" \
  "TENANT_{TENANT_ID}_GOOGLE_INDIVIDUAL_CLIENT_SECRET=your-client-secret"

# Service Account Credentials (if using corporate accounts)
supabase secrets set --project-ref YOUR_PROJECT_REF \
  "TENANT_{TENANT_ID}_GOOGLE_CORPORATE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com" \
  "TENANT_{TENANT_ID}_GOOGLE_CORPORATE_SERVICE_ACCOUNT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Note**: Replace `{TENANT_ID}` with the actual tenant UUID (lowercase, hyphenated format).

### Option B: Platform-Level Credentials

Store credentials in Vercel Environment Variables:

```bash
# OAuth Client Credentials
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_SHEETS_REDIRECT_URI=https://your-domain.com/api/integrations/google-sheets/callback

# Service Account Credentials
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Important**: The `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` should contain literal `\n` characters (not actual newlines) when stored as an environment variable.

## Verification Checklist

- [ ] Both OAuth client and service account are in the same Google Cloud project
- [ ] Google Sheets API is enabled
- [ ] Google Drive API is enabled (if using)
- [ ] OAuth consent screen is configured
- [ ] OAuth client has correct redirect URIs
- [ ] Service account key is downloaded and stored securely
- [ ] Domain-wide delegation is configured (if using Google Workspace)
- [ ] Credentials are stored in Supabase Secrets or Vercel (not in code)

## Common Issues

### Issue: "OAuth client and service account are in different projects"

**Solution**: Both must be in the same Google Cloud project. If you created them separately:
1. Delete one of them
2. Recreate it in the correct project
3. Or use the Google Cloud Console to move resources (if possible)

### Issue: "Redirect URI mismatch"

**Solution**: 
1. Ensure the redirect URI in your code matches exactly what's configured in Google Cloud Console
2. Check for trailing slashes, HTTP vs HTTPS, and port numbers
3. Wait a few minutes after updating (Google caches redirect URIs)

### Issue: "Service account cannot access spreadsheets"

**Solution**:
1. For user-owned spreadsheets: Share the spreadsheet with the service account email
2. For Workspace accounts: Ensure domain-wide delegation is properly configured
3. Verify the service account has the correct scopes

### Issue: "Domain-wide delegation not working"

**Solution**:
1. Verify the Client ID in Google Workspace Admin matches the service account Client ID
2. Ensure scopes are correctly formatted (comma-separated, no spaces)
3. Wait a few minutes after configuration (changes can take time to propagate)

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use Supabase Secrets** for tenant-specific credentials
3. **Rotate credentials** periodically (every 90 days recommended)
4. **Limit OAuth scopes** to minimum required
5. **Use HTTPS** in production
6. **Enable 2FA** on Google accounts used for OAuth
7. **Monitor usage** in Google Cloud Console > APIs & Services > Dashboard
8. **Restrict service account keys** - only create keys when needed, delete unused keys

## Additional Resources

- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Service Accounts Documentation](https://cloud.google.com/iam/docs/service-accounts)
- [Domain-Wide Delegation Guide](https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority)
- [Google Sheets API Documentation](https://developers.google.com/sheets/api)

## Next Steps

After setting up your Google Cloud project:

1. Configure credentials in your application (Supabase Secrets or Vercel)
2. Test OAuth flow with a test user
3. Test service account access (if configured)
4. Test domain-wide delegation (if using Google Workspace)
5. Monitor usage and errors in Google Cloud Console

For detailed integration setup, see:
- [Google Workspace Setup Guide](./GOOGLE_WORKSPACE_SETUP.md)
- [Tenant OAuth Credentials Management](./TENANT_OAUTH_CREDENTIALS.md)

