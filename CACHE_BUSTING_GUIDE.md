# Cache Busting Guide - Force Fresh Deployment

## Problem
Changes are working on localhost but not appearing in the deployed Vercel environment due to build cache.

## Solutions Applied

### 1. Cache-Control Headers
Added no-cache headers for `/dashboard/review` page in `next.config.ts`:
- `Cache-Control: no-store, no-cache, must-revalidate`
- `Pragma: no-cache`
- `Expires: 0`

### 2. Component Version Update
Updated component version from `v2.0` to `v2.1-with-bulk-actions-2025-12-25-cache-bust` to force a rebuild.

### 3. Build Timestamp
Added `BUILD_TIMESTAMP` that changes on every build to ensure cache invalidation.

### 4. Vercel Configuration
Updated `vercel.json` with explicit build commands to ensure proper build process.

## Manual Cache Clearing Steps

### Option 1: Use the Force Rebuild Script
```bash
./scripts/force-vercel-rebuild.sh
```

### Option 2: Manual Vercel CLI Deployment
```bash
cd apps/portal
vercel --prod --force
```

### Option 3: Clear Vercel Build Cache via Dashboard
1. Go to Vercel Dashboard → Your Project → Settings
2. Navigate to "Build & Development Settings"
3. Click "Clear Build Cache"
4. Redeploy the project

### Option 4: Trigger Redeploy via Git
```bash
# Make a small change to force redeploy
git commit --allow-empty -m "chore: force redeploy to clear cache"
git push origin develop
```

## Verification Steps

After deployment:

1. **Check Version Indicator**
   - Navigate to `/dashboard/review`
   - Look for the blue banner at the top
   - Should show: `v2.1-with-bulk-actions-2025-12-25-cache-bust`
   - Build timestamp should be recent

2. **Check Browser Console**
   - Open DevTools (F12)
   - Look for `[ReviewPage]` logs
   - Should show the new component version

3. **Hard Refresh**
   - Mac: Cmd+Shift+R
   - Windows/Linux: Ctrl+Shift+R
   - This bypasses browser cache

4. **Verify UI Elements**
   - Checkboxes should be visible in table header and rows
   - Bulk action buttons should appear when items are selected

## If Changes Still Don't Appear

1. **Check Vercel Build Logs**
   - Go to Vercel Dashboard → Deployments
   - Click on the latest deployment
   - Check build logs for errors or warnings
   - Verify the correct commit is being built

2. **Verify Git Commit**
   ```bash
   git log --oneline -5
   ```
   Ensure your latest commits are there.

3. **Check Environment Variables**
   - Verify all required env vars are set in Vercel
   - Some changes might require specific env vars

4. **Clear Browser Cache Completely**
   - Clear all site data for the domain
   - Use incognito/private mode to test

5. **Check CDN Cache**
   - Vercel uses a CDN that might cache responses
   - The no-cache headers should prevent this, but if issues persist:
     - Wait 5-10 minutes for CDN propagation
     - Or contact Vercel support to clear CDN cache

## Prevention

To prevent future cache issues:

1. **Always update component version** when making UI changes
2. **Use build timestamps** for cache invalidation
3. **Set appropriate cache headers** for dynamic pages
4. **Test in incognito mode** after deployment
5. **Monitor Vercel build logs** to ensure latest code is built

## Related Files

- `apps/portal/next.config.ts` - Cache headers configuration
- `apps/portal/app/dashboard/review/page.tsx` - Component with version marker
- `vercel.json` - Vercel deployment configuration
- `scripts/force-vercel-rebuild.sh` - Force rebuild script

