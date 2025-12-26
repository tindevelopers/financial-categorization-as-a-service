# Google Sheets Export - Hybrid Approach

## Overview

The Google Sheets export functionality supports **two authentication methods** that work together seamlessly:

- **Option A: Service Account (Corporate/Company-Level)** - For Google Workspace organizations
- **Option B: User OAuth (Individual-Level)** - For individual users or accounts without admin access

## How It Works

The system automatically chooses the best available authentication method:

1. **First Priority: Service Account (Option A)**
   - Used when `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` are configured
   - Best for corporate/Google Workspace users
   - No user interaction required
   - Requires domain-wide delegation setup (if impersonating users)

2. **Fallback: User OAuth (Option B)**
   - Used when service account is not available but user has connected their Google account
   - Best for individual users
   - Requires user to connect their Google account via OAuth flow
   - No admin access required

3. **Final Fallback: CSV Export**
   - If neither authentication method is available, exports as CSV file download

## Current Configuration

### For `developer@tin.info` Account

✅ **Using Option B (User OAuth)**
- Individual OAuth connection is already configured
- Users connect their own Google accounts
- No Google Workspace admin access required
- Works immediately for individual users

### For Google Workspace Companies

✅ **Supports Both Options**
- **Option A**: If domain-wide delegation is set up, service account can impersonate users automatically
- **Option B**: Users can also connect their individual Google accounts as a fallback or alternative
- Both methods can coexist - system uses the best available

## Authentication Priority

```
1. Service Account (Option A) - if configured
   ↓ (if not available)
2. User OAuth (Option B) - if user has connected Google account
   ↓ (if not available)
3. CSV Export - fallback download
```

## Benefits of This Approach

1. **Flexibility**: Works for both individual users and corporate accounts
2. **No Admin Required**: Individual users can use OAuth without admin setup
3. **Corporate Support**: Google Workspace companies can use service account for automatic exports
4. **Graceful Degradation**: Falls back to CSV if Google Sheets is unavailable
5. **User Choice**: Corporate users can use either method depending on their needs

## Setup Requirements

### Option A: Service Account (Corporate)

**Environment Variables:**
```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=fincat-service-account@financial-categorization.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Optional (for user impersonation):**
- Domain-wide delegation authorization in Google Workspace Admin Console
- OAuth2 Client ID: `102883458523619415855`
- Scopes: `https://www.googleapis.com/auth/spreadsheets`, `https://www.googleapis.com/auth/drive.file`

### Option B: User OAuth (Individual)

**Environment Variables:**
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_SHEETS_REDIRECT_URI=https://your-domain.com/api/integrations/google-sheets/callback
ENCRYPTION_KEY=your-32-byte-hex-key
```

**User Action Required:**
- User must connect their Google account via Settings > Integrations > Google Sheets
- One-time OAuth flow per user

## Code Implementation

The export route (`apps/portal/app/api/categorization/jobs/[jobId]/export/google-sheets/route.ts`) implements this logic:

1. Checks for service account credentials
2. If not available, checks for user's OAuth tokens in database
3. Uses appropriate authentication method
4. Falls back to CSV if neither is available

## Logging

The system logs which authentication method is used:
- `"Google Sheets export: Using service account (Option A)"`
- `"Google Sheets export: Using user OAuth (Option B)"`
- `"Google Sheets export: Export completed successfully using [method]"`

## Troubleshooting

### "No Google authentication method available"
- **For Individual Users**: Connect your Google account in Settings > Integrations
- **For Corporate**: Ensure service account credentials are configured

### "Token expired. Please reconnect"
- User's OAuth token has expired
- User needs to reconnect their Google account
- System will attempt to refresh token automatically if refresh token is available

### "Failed to create spreadsheet"
- Check Google API permissions
- Verify authentication method has proper scopes
- Check Google Cloud Console for API enablement

## Summary

✅ **Current Setup**: Using Option B (User OAuth) for `developer@tin.info`
✅ **Future Ready**: Supports Option A (Service Account) for Google Workspace companies
✅ **Flexible**: Both methods can work together
✅ **User-Friendly**: No admin access required for individual users

