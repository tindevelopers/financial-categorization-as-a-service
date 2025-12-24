# Vercel Deployment Checklist

## ✅ Code Committed
- All Phase 2 & 3 changes committed to `main` branch
- Commit hash: `0e10f91`
- 43 files changed, 6658 insertions

## 🔧 Vercel Configuration

### Build Settings
- ✅ `vercel.json` configured with:
  - Framework: Next.js
  - Install command: `pnpm install`
  - Region: `iad1` (US East)

### Required Environment Variables

Add these to your Vercel project settings (Settings → Environment Variables):

#### Supabase (Required)
```
NEXT_PUBLIC_SUPABASE_URL=https://firwcvlikjltikdrmejq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

#### Google Cloud (Required for Invoice OCR)
```
GOOGLE_CLOUD_PROJECT_ID=<your-project-id>
GOOGLE_CLOUD_LOCATION=us
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=<your-processor-id>
GOOGLE_APPLICATION_CREDENTIALS=<path-to-service-account-key.json>
# OR use GOOGLE_APPLICATION_CREDENTIALS_JSON with base64 encoded JSON
```

#### Google OAuth (Required for Google Sheets and Google Drive)
```
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
# For Google Sheets integration:
GOOGLE_REDIRECT_URI=https://your-domain.com/api/integrations/google-sheets/callback
# For Google Drive integration (if different):
# GOOGLE_REDIRECT_URI=https://your-domain.com/api/storage/drive/callback
# Note: If using both, you may need separate OAuth credentials or add both redirect URIs to the same OAuth app
```

#### Dropbox OAuth (Required for Cloud Storage)
```
DROPBOX_APP_KEY=<your-dropbox-app-key>
DROPBOX_APP_SECRET=<your-dropbox-app-secret>
DROPBOX_REDIRECT_URI=https://your-domain.com/api/storage/dropbox/callback
```

#### AI Categorization (Optional - defaults to rule-based if not set)
```
USE_AI_CATEGORIZATION=true
AI_CATEGORIZATION_PROVIDER=vercel_ai_gateway
OPENAI_API_KEY=<your-openai-api-key>
```

#### Encryption (Required for OAuth token storage)
```
ENCRYPTION_KEY=<32-byte-hex-key>
# Generate with: openssl rand -hex 32
```

#### App URL (Required for OAuth redirects)
```
NEXT_PUBLIC_APP_URL=https://your-domain.com
# This is used to construct redirect URIs if GOOGLE_REDIRECT_URI is not set
# Default redirect URIs:
# - Google Sheets: ${NEXT_PUBLIC_APP_URL}/api/integrations/google-sheets/callback
# - Google Drive: ${NEXT_PUBLIC_APP_URL}/api/storage/drive/callback
```

### Build Command
Vercel should auto-detect Next.js, but ensure:
- Root directory: `/` (or set in Vercel dashboard)
- Build command: `pnpm build` (auto-detected)
- Output directory: `.next` (auto-detected)

### Monorepo Configuration
If using Vercel's monorepo support:
- Root directory: `/`
- Framework: Next.js
- Build command: `cd apps/portal && pnpm build`
- Or configure in `vercel.json`:

```json
{
  "buildCommand": "pnpm --filter @tinadmin/portal build",
  "installCommand": "pnpm install"
}
```

## 🚀 Deployment Steps

1. **Push to GitHub** ✅ (Already done)
   - Changes are on `main` branch

2. **Configure Vercel Project**
   - Link repository if not already linked
   - Set environment variables (see above)
   - Configure build settings

3. **Deploy**
   - Vercel will auto-deploy on push to `main`
   - Or trigger manual deployment from Vercel dashboard

4. **Verify Deployment**
   - Check build logs for errors
   - Test endpoints:
     - `/api/categorization/upload`
     - `/api/storage/status`
     - `/upload` page
     - `/invoices/upload` page

## 📝 Notes

- **Google Service Account**: Upload the service account JSON key file to Vercel or use environment variable with base64-encoded JSON
- **OAuth Redirect URIs**: Must match exactly (including protocol and domain)
- **Storage Bucket**: Already created in Supabase, no action needed
- **Database Migrations**: Already applied to remote database ✅

## 🔍 Troubleshooting

If deployment fails:
1. Check build logs in Vercel dashboard
2. Verify all environment variables are set
3. Check that `pnpm-lock.yaml` is committed
4. Ensure Google service account credentials are accessible
5. Verify OAuth redirect URIs match exactly

## ✅ Fixed Issues

### Server Components Render Error on Signin (2025-01-XX)
- **Problem**: 500 error on `/signin` page with "Server Components render" error
- **Cause**: Incorrect relative image path in auth layout (`./images/logo/auth-logo.svg`)
- **Solution**: Changed to absolute path (`/images/logo/auth-logo.svg`)
- **Commit**: `8afd3ef`


