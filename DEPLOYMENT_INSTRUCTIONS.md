# Force Vercel Rebuild - Instructions

## Issue
The CLI deployment is having trouble with the monorepo structure. Use one of these methods:

## Method 1: Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/tindeveloper/portal
   - Or navigate to: Vercel Dashboard → Projects → portal

2. **Clear Build Cache**
   - Go to Settings → Build & Development Settings
   - Click "Clear Build Cache" button
   - Confirm the action

3. **Redeploy**
   - Go to Deployments tab
   - Find the latest deployment (should be commit `b7ded11`)
   - Click the "..." menu → "Redeploy"
   - Select "Use existing Build Cache" = **OFF** (unchecked)
   - Click "Redeploy"

4. **Wait for Build**
   - Monitor the build logs
   - Should complete in 2-5 minutes

## Method 2: Verify Vercel Project Settings

Ensure your Vercel project is configured correctly:

1. **Root Directory**
   - Settings → General → Root Directory
   - Should be: `apps/portal`

2. **Build Command**
   - Settings → Build & Development Settings → Build Command
   - Should be: `pnpm build` or `cd ../.. && pnpm install && pnpm turbo run build --filter=@tinadmin/portal`

3. **Install Command**
   - Should be: `cd ../.. && pnpm install`

4. **Output Directory**
   - Should be: `.next` (Next.js default)

## Method 3: GitHub Integration (Automatic)

Since you've pushed to `develop`, Vercel should automatically deploy:

1. **Check GitHub Integration**
   - Vercel Dashboard → Settings → Git
   - Ensure `develop` branch is connected
   - Auto-deployments should be enabled

2. **Verify Latest Commit**
   - The latest commit `b7ded11` should trigger a deployment
   - Check Deployments tab for status

3. **If Not Deploying**
   - Go to Settings → Git
   - Click "Redeploy" or "Redeploy All"

## Method 4: Manual CLI Deployment (If Needed)

If you need to use CLI, ensure Vercel project is linked correctly:

```bash
cd apps/portal
vercel link
# Follow prompts to link to existing project

# Then deploy
vercel --prod --force --yes
```

## Verification After Deployment

1. **Check Version Indicator**
   - Navigate to: `https://fincat.develop.tinconnect.com/dashboard/review`
   - Look for blue banner showing: `v2.1-with-bulk-actions-2025-12-25-cache-bust`

2. **Hard Refresh**
   - Mac: Cmd+Shift+R
   - Windows/Linux: Ctrl+Shift+R

3. **Check Console Logs**
   - Open DevTools (F12)
   - Look for `[ReviewPage]` logs
   - Should show new component version

4. **Verify UI Elements**
   - Checkboxes should be visible
   - Bulk action buttons should appear when items selected

## Current Status

- ✅ Latest commit: `b7ded11`
- ✅ Cache-busting headers added
- ✅ Component version updated to `v2.1`
- ✅ Build timestamp added
- ⏳ Waiting for Vercel deployment

## Next Steps

1. Use Method 1 (Dashboard) to force a fresh rebuild
2. Wait for deployment to complete
3. Verify changes are live
4. If issues persist, check Vercel build logs for errors

