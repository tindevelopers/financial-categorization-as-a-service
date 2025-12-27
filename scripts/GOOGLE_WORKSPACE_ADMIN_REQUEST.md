# Google Workspace Admin Authorization Request

## Situation

You need to enable **Domain-Wide Delegation** for your Google Cloud service account, but `developer@tin.info` doesn't have Google Workspace Admin Console access. This is a **one-time setup** that requires a **Google Workspace Super Admin** to complete.

## What is Domain-Wide Delegation?

Domain-wide delegation allows your service account to **impersonate users** in your Google Workspace domain. This enables:

- **Corporate/Company-level Google Sheets export** - Export directly to Google Sheets without individual user OAuth consent
- **Server-side operations** - Create and manage Google Sheets on behalf of users automatically
- **No user interaction required** - Users don't need to connect their Google accounts individually

## Two Options for Google Sheets Integration

### Option A: Corporate/Company-Level (Requires Domain-Wide Delegation) ⭐

**Best for:** Organizations with Google Workspace where you want automatic, server-side Google Sheets export without user interaction.

**Requirements:**
- Google Workspace account
- Google Workspace Super Admin access
- Domain-wide delegation authorization

**Status:** ✅ Service account ready, ⏳ Waiting for Google Workspace Admin authorization

### Option B: Individual User OAuth (No Admin Required) ✅

**Best for:** Individual users or organizations without Google Workspace admin access.

**Requirements:**
- Individual Google account (Gmail or Google Workspace)
- User connects their Google account via OAuth flow
- No admin access needed

**Status:** ✅ Already configured and working (see `GOOGLE_SHEETS_SETUP_COMPLETE.md`)

## Next Steps

### If You Need Corporate/Company-Level Export (Option A)

You need to **contact your Google Workspace Super Admin** and provide them with the following information:

---

## 📧 Email Template for Google Workspace Admin

**Subject:** Request to Authorize Google Cloud Service Account for Domain-Wide Delegation

**Body:**

Hi [Google Workspace Admin Name],

I need your help to authorize a Google Cloud service account for domain-wide delegation. This will enable our application to automatically export data to Google Sheets on behalf of users in our organization.

**Action Required:**
Please complete the following steps in Google Workspace Admin Console:

1. Go to: https://admin.google.com
2. Navigate to: **Security** → **API Controls** → **Domain-wide Delegation**
3. Click **"Add new"** or **"Manage Domain-wide Delegation"**
4. Add the following authorization:

   **Client ID:** `102883458523619415855`
   
   **OAuth Scopes** (add both):
   ```
   https://www.googleapis.com/auth/spreadsheets
   https://www.googleapis.com/auth/drive.file
   ```

5. Click **"Authorize"**

**What This Enables:**
- Automatic Google Sheets export functionality
- Server-side operations without individual user consent
- Improved user experience for corporate users

**Security Note:**
This service account is already configured in Google Cloud Console and is only requesting access to Google Sheets and Drive files. It cannot access other Google services or user data outside of these scopes.

**Questions?**
If you have any concerns or questions, please let me know. This is a standard Google Workspace integration setup.

Thank you!

---

### If Individual OAuth is Sufficient (Option B)

**You're all set!** The individual OAuth integration is already configured and working. Users can:

1. Visit the integrations page
2. Click "Connect with Google"
3. Authorize the application
4. Export to Google Sheets using their own Google account

**No admin access required** - each user connects their own Google account.

## How to Check Which Option You're Using

### Check Your Code

Look at your Google Sheets export route:
- **Service Account** (`GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`): Uses Option A (requires domain-wide delegation)
- **OAuth** (`GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`): Uses Option B (individual user connections)

### Current Configuration

Based on your environment variables:

**If you have:**
- ✅ `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` → You're using Option A (needs admin authorization)
- ✅ `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` → You're using Option B (already working)

**You can use both simultaneously** - the code will prefer service account if available, fall back to OAuth if not.

## Summary

| Feature | Option A (Corporate) | Option B (Individual) |
|---------|---------------------|----------------------|
| **Admin Required** | ✅ Yes (Super Admin) | ❌ No |
| **User Interaction** | ❌ No (automatic) | ✅ Yes (OAuth flow) |
| **Setup Complexity** | Medium (needs admin) | Low (already done) |
| **Best For** | Google Workspace orgs | Individual users |
| **Status** | ⏳ Waiting for admin | ✅ Ready to use |

## Recommendation

**If you're unsure which to use:**

1. **Start with Option B (Individual OAuth)** - It's already working and doesn't require admin access
2. **Upgrade to Option A later** - If you need automatic, server-side exports for corporate users, request admin authorization then

Both options can coexist - your application will use the best available method automatically.

