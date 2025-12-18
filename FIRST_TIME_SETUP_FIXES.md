# First-Time Setup Error Fixes

## Overview
This document outlines the fixes applied to resolve 404/405 errors and white label settings errors that occur during first-time setup when no users/tenants exist yet.

## Problems Identified

1. **404 Error on Root Route (`/`)**: Missing root `page.tsx` file
2. **405 Errors**: API routes receiving CORS preflight requests without OPTIONS handlers
3. **White Label Settings Error**: Server actions failing when database columns/tables don't exist yet

## Fixes Applied

### 1. Create Root Page (`src/app/page.tsx`)

**Problem**: Accessing the root URL (`/`) resulted in a 404 error because no root page existed.

**Solution**: Created a root page that checks authentication status and redirects appropriately.

**File**: `src/app/page.tsx` (NEW FILE)

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/core/database/server";

export default async function RootPage() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // User is authenticated, redirect to dashboard
      redirect("/saas/dashboard");
    } else {
      // User is not authenticated, redirect to sign in
      redirect("/signin");
    }
  } catch (error) {
    // If there's any error (e.g., database connection issues), redirect to signin
    console.error("Error checking authentication:", error);
    redirect("/signin");
  }
}
```

**Action Required**: Create this file if it doesn't exist in your codebase.

---

### 2. Enhanced White Label Error Handling

**Problem**: White label server actions (`getBrandingSettings`, `getThemeSettings`, `getCustomCSS`, etc.) were failing when:
- Database columns don't exist yet (e.g., `branding`, `theme_settings`, `custom_css`)
- The `tenants` table doesn't exist yet
- No tenant context is available

**Solution**: Added comprehensive error handling to gracefully handle missing database columns and tables.

**File**: `src/app/actions/white-label.ts`

#### Changes Made:

1. **Added table existence check** before querying columns
2. **Added column existence error detection** (PostgreSQL error code `42703`)
3. **Return empty defaults** instead of throwing errors

#### Example Fix for `getBrandingSettings()`:

**Before:**
```typescript
const result = await supabase
  .from("tenants")
  .select("branding")
  .eq("id", tenantId)
  .single();

if (result.error) {
  console.error("Error fetching branding settings:", result.error);
  return {};
}
```

**After:**
```typescript
// Check if tenants table exists by attempting a simple query first
try {
  const tableCheck = await supabase.from("tenants").select("id").limit(1);
  if (tableCheck.error && (tableCheck.error.code === "42P01" || tableCheck.error.message?.includes("does not exist"))) {
    console.warn("Tenants table does not exist yet - returning empty branding settings");
    return {};
  }
} catch (tableError) {
  // Table might not exist, return empty settings
  console.warn("Could not verify tenants table exists:", tableError);
  return {};
}

const result = await supabase
  .from("tenants")
  .select("branding")
  .eq("id", tenantId)
  .single();

if (result.error) {
  // Handle missing column error (column doesn't exist in database yet)
  if (result.error.code === "42703" || result.error.message?.includes("column") || result.error.message?.includes("does not exist")) {
    console.warn("Branding column not found in tenants table - returning empty settings");
    return {};
  }
  console.error("Error fetching branding settings:", result.error);
  return {};
}
```

#### Functions Updated:

Apply the same pattern to these functions:
- `getBrandingSettings()`
- `getThemeSettings()`
- `getEmailSettings()`
- `getCustomCSS()`
- `getCustomDomains()`

**Action Required**: Update all white label getter functions in `src/app/actions/white-label.ts` with the enhanced error handling pattern shown above.

---

### 3. Fixed API Route CORS Errors (405 Errors)

**Problem**: API routes were returning 405 (Method Not Allowed) errors for CORS preflight OPTIONS requests.

**Solution**: Added `OPTIONS` handlers to all API routes to handle CORS preflight requests.

**Files**: 
- `src/app/api/admin/check-platform-admin/route.ts`
- `src/app/api/admin/test-tenant-access/route.ts`
- `src/app/api/webhooks/stripe/route.ts`

#### Example Fix:

**Before:**
```typescript
export async function GET() {
  // ... handler code
}
```

**After:**
```typescript
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function GET() {
  // ... handler code
}
```

#### Specific Changes:

1. **`/api/admin/check-platform-admin`**: Add OPTIONS handler with `GET, OPTIONS` methods
2. **`/api/admin/test-tenant-access`**: Add OPTIONS handler with `GET, OPTIONS` methods
3. **`/api/webhooks/stripe`**: Add OPTIONS handler with `POST, OPTIONS` methods and `stripe-signature` header

**Action Required**: Add `OPTIONS` handlers to all API routes that receive requests from the browser.

---

### 4. Improved Supabase Client Error Messages

**File**: `packages/@tinadmin/core/src/database/client.ts`

**Change**: Enhanced error messages to provide better debugging information.

**Before:**
```typescript
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    `Missing Supabase environment variables. ` +
    `NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'SET' : 'MISSING'}, ` +
    `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'SET' : 'MISSING'}. ` +
    `Please check your .env.local file and restart the dev server.`
  );
}
```

**After:**
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  const urlStatus = supabaseUrl ? 'SET' : 'MISSING';
  const keyStatus = supabaseAnonKey ? 'SET' : 'MISSING';
  
  throw new Error(
    `Missing Supabase environment variables. ` +
    `NEXT_PUBLIC_SUPABASE_URL: ${urlStatus}, ` +
    `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${keyStatus}. ` +
    `Please check your .env.local file and restart the dev server. ` +
    `If using a monorepo, ensure environment variables are properly configured.`
  );
}

try {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
} catch (error) {
  // If createBrowserClient throws an error, provide more context
  if (error instanceof Error && error.message.includes('URL and API key')) {
    throw new Error(
      `Failed to create Supabase client: Environment variables may be empty or invalid. ` +
      `NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'present' : 'missing'}, ` +
      `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'present' : 'missing'}. ` +
      `Please verify your .env.local file contains valid values and restart your dev server.`
    );
  }
  throw error;
}
```

**Action Required**: Update the Supabase client creation function with improved error handling and trimming of environment variables.

---

## Testing Checklist

After applying these fixes, verify:

- [ ] Root URL (`/`) redirects correctly (to `/signin` when not authenticated, `/saas/dashboard` when authenticated)
- [ ] White label settings load without errors on first setup (even with empty database)
- [ ] No 405 errors appear in browser console
- [ ] Application works correctly with:
  - Database migrations done but no data exists
  - No users/tenants created yet
  - White label settings columns don't exist yet

## Error Codes Reference

When handling database errors, watch for these PostgreSQL error codes:

- **`42703`**: Undefined column (column doesn't exist)
- **`42P01`**: Undefined table (table doesn't exist)

## Additional Notes

1. **First-Time Setup**: These fixes ensure the application gracefully handles scenarios where the database structure exists but no data has been populated yet.

2. **Error Handling Philosophy**: All white label functions now return empty defaults (`{}`, `""`, or `[]`) instead of throwing errors, allowing the application to continue functioning even when settings don't exist.

3. **CORS**: The OPTIONS handlers are essential for browser-based requests. Without them, CORS preflight requests will fail with 405 errors.

4. **Environment Variables**: Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in `.env.local` and restart the dev server after adding them.

---

## Summary

These fixes ensure that:
- ✅ Users can access the root URL without 404 errors
- ✅ API routes handle CORS preflight requests correctly
- ✅ White label settings load gracefully even when database columns/tables don't exist
- ✅ Better error messages help with debugging setup issues
- ✅ Application works correctly during first-time setup scenarios

All changes are backward compatible and don't affect existing functionality.
