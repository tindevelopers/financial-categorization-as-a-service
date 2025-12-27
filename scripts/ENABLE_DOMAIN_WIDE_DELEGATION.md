# Enable Domain-Wide Delegation for Google Cloud Service Account

This guide shows you how to enable domain-wide delegation for your Google Cloud service account using the CLI.

## Prerequisites

1. **gcloud CLI installed**: [Install Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
2. **Authenticated with gcloud**: Run `gcloud auth login`
3. **Google Workspace Admin access**: You'll need Super Admin privileges for Step 2

## Quick Start

### Option 1: Run the Automated Script

```bash
cd /Users/gene/Projects/financial-categorization-as-a-service
./scripts/enable-domain-wide-delegation.sh
```

### Option 2: Manual CLI Commands

```bash
# Set your project
gcloud config set project financial-categorization

# Get the OAuth2 Client ID (uniqueId) for your service account
gcloud iam service-accounts describe fincat-service-account@financial-categorization.iam.gserviceaccount.com \
    --format="value(uniqueId)"
```

This will output the OAuth2 Client ID (e.g., `102883458523619415855`).

## Step-by-Step Instructions

### Step 1: Enable Domain-Wide Delegation (Google Cloud Console)

**Note**: Domain-wide delegation is enabled by default for service accounts. You just need to note the OAuth2 Client ID.

#### Via CLI:
```bash
# Get the OAuth2 Client ID
OAUTH_CLIENT_ID=$(gcloud iam service-accounts describe \
    fincat-service-account@financial-categorization.iam.gserviceaccount.com \
    --format="value(uniqueId)")

echo "OAuth2 Client ID: $OAUTH_CLIENT_ID"
```

#### Via Google Cloud Console (Alternative):
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **IAM & Admin** → **Service Accounts**
3. Click on `fincat-service-account@financial-categorization.iam.gserviceaccount.com`
4. Note the **OAuth2 Client ID** (shown in the service account details)
5. Ensure **Domain-wide Delegation** is enabled (it's enabled by default)

**Expected OAuth2 Client ID**: `102883458523619415855`

### Step 2: Authorize in Google Workspace Admin Console

**⚠️ This step requires Google Workspace Super Admin privileges and cannot be done via CLI.**

1. Go to [Google Workspace Admin Console](https://admin.google.com)
2. Navigate to **Security** → **API Controls** → **Domain-wide Delegation**
3. Click **Add new** or **Manage Domain-wide Delegation**
4. Add the following authorization:

   **Client ID**: `102883458523619415855`
   
   **OAuth Scopes** (one per line or comma-separated):
   ```
   https://www.googleapis.com/auth/spreadsheets
   https://www.googleapis.com/auth/drive.file
   ```

5. Click **Authorize**

## Verify Setup

After completing both steps, you can verify the setup:

```bash
# Verify service account exists and get details
gcloud iam service-accounts describe \
    fincat-service-account@financial-categorization.iam.gserviceaccount.com \
    --format="yaml(uniqueId,email,displayName)"
```

## Troubleshooting

### Error: Service account not found
- Verify the service account email is correct
- Check that you're authenticated: `gcloud auth list`
- Verify the project ID: `gcloud config get-value project`

### Error: Permission denied
- Ensure you have `iam.serviceAccounts.get` permission
- You may need to run: `gcloud auth login --update-adc`

### OAuth2 Client ID doesn't match
- The OAuth2 Client ID is the service account's `uniqueId`
- Use the actual value returned by the CLI command
- Update the Client ID in Google Workspace Admin Console if it differs

## What This Enables

Once domain-wide delegation is set up, your service account can:

- **Impersonate users** in your Google Workspace domain
- **Access Google Sheets** on behalf of users without requiring individual OAuth consent
- **Access Google Drive files** that users have shared with the service account
- **Perform server-side operations** without user interaction

## Usage in Your Application

After setup, you can use the service account to impersonate users:

```typescript
import { google } from 'googleapis';

const auth = new google.auth.JWT({
  email: 'fincat-service-account@financial-categorization.iam.gserviceaccount.com',
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
  ],
  subject: 'user@yourdomain.com' // Impersonate this user
});

const sheets = google.sheets({ version: 'v4', auth });
```

## References

- [Google Cloud Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
- [Domain-wide Delegation](https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority)
- [Google Workspace Admin Console](https://admin.google.com)

