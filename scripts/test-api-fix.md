# Testing the Categorization API Fix

## What Was Fixed

The categorization API routes were updated to use `createClient()` instead of `createClientFromRequest()`. This ensures that cookies refreshed by middleware are properly read by the API route handlers.

## Files Changed

1. `src/app/api/categorization/jobs/route.ts`
2. `src/app/api/categorization/jobs/[jobId]/transactions/route.ts`

## How to Test

### Option 1: Manual Browser Testing

1. Start the development server:
   ```bash
   pnpm dev:portal
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3002
   ```

3. Sign in with your credentials

4. Open the browser's Developer Tools (F12) and go to the Network tab

5. Navigate to a page that loads categorization jobs (e.g., `/dashboard/uploads`)

6. Look for requests to `/api/categorization/jobs`

7. **Expected Result**: Status code should be `200` (not `401`)

### Option 2: Using curl with Authentication Cookies

1. Sign in through the browser

2. Open Developer Tools → Application → Cookies

3. Find the Supabase auth cookie (usually named `sb-<project-ref>-auth-token`)

4. Copy the cookie value

5. Test the API endpoint:
   ```bash
   curl -X GET 'http://localhost:3002/api/categorization/jobs' \
     -H 'Cookie: sb-<project-ref>-auth-token=<your-token-here>'
   ```

6. **Expected Result**: Should return JSON with jobs array, not `{"error": "Unauthorized"}`

### Option 3: Using the Test Script

Run the automated test script:

```bash
# Set test credentials (optional - will prompt if not set)
export TEST_EMAIL=your@email.com
export TEST_PASSWORD=yourpassword

# Run the test
pnpm test:api
```

Or directly:
```bash
node scripts/test-categorization-api.js
```

## Expected Behavior

### Before the Fix
- ❌ API requests returned `401 Unauthorized` even when authenticated
- ❌ Cookies refreshed by middleware weren't being read by API routes

### After the Fix
- ✅ API requests return `200 OK` when properly authenticated
- ✅ Cookies refreshed by middleware are properly read
- ✅ Authentication state is correctly maintained

## Verification Checklist

- [ ] Unauthenticated requests return `401 Unauthorized`
- [ ] Authenticated requests return `200 OK` with job data
- [ ] No `401` errors in browser console when navigating authenticated pages
- [ ] Jobs list loads correctly in the UI
- [ ] Transactions endpoint works for existing jobs

## Troubleshooting

If you still see `401` errors:

1. **Check if cookies are being set**: Look in browser DevTools → Application → Cookies
2. **Verify middleware is running**: Check server logs for `[middleware]` messages
3. **Check Supabase configuration**: Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly
4. **Clear browser cache**: Sometimes stale cookies can cause issues
5. **Check server logs**: Look for authentication errors in the terminal running `pnpm dev`

