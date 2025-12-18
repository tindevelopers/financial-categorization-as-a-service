# Complete Code Changes - Copy This File

## Instructions for Development Team

This file contains **ALL code changes** that need to be applied to your repository. Copy the code blocks below and apply them to your codebase.

---

## 📁 FILE 1: Create Root Page (Main App)

**File Path:** `src/app/page.tsx`

**Action:** CREATE NEW FILE

**Complete Code:**
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

---

## 📁 FILE 2: Create Root Page (Admin App - Monorepo)

**File Path:** `apps/admin/app/page.tsx`

**Action:** CREATE NEW FILE (if using monorepo)

**Complete Code:**
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

---

## 📁 FILE 3: Create Signin Page (Admin App - Monorepo)

**File Path:** `apps/admin/app/signin/page.tsx`

**Action:** CREATE NEW FILE (if using monorepo)

**Complete Code:**
```typescript
import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | SaaS Admin",
  description: "Sign in to your SaaS admin dashboard",
};

export default function SignIn() {
  return <SignInForm />;
}
```

---

## 📁 FILE 4: Update Supabase Browser Client

**File Path:** `packages/@tinadmin/core/src/database/client.ts`

**Action:** REPLACE ENTIRE FILE with:

**Complete Code:**
```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
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
}
```

---

## 📁 FILE 5: Update Supabase Server Client (Package)

**File Path:** `packages/@tinadmin/core/src/database/server.ts`

**Action:** REPLACE ENTIRE FILE with:

**Complete Code:**
```typescript
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();

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

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
            // The `remove` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
```

---

## 📁 FILE 6: Update Supabase Server Client (Src)

**File Path:** `src/core/database/server.ts`

**Action:** REPLACE ENTIRE FILE with same code as FILE 5 above

---

## 📁 FILE 7: Update White Label Actions

**File Path:** `src/app/actions/white-label.ts`

**Action:** UPDATE EXISTING FUNCTIONS

### Function 1: `getBrandingSettings()`

**Find this function and REPLACE it with:**

```typescript
export async function getBrandingSettings(): Promise<BrandingSettings> {
  try {
    // Check authentication first
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {};
    }

    // Check permission, but don't throw if not authenticated
    try {
      await requirePermission("settings.read");
    } catch {
      // If permission check fails (e.g., not authenticated), return empty
      return {};
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return {};
    }

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

    const result: { data: { branding: Record<string, unknown> | null } | null; error: any } = await supabase
      .from("tenants")
      .select("branding")
      .eq("id", tenantId)
      .single();

    const tenant = result.data;
    if (result.error) {
      // Handle missing column error (column doesn't exist in database yet)
      if (result.error.code === "42703" || result.error.message?.includes("column") || result.error.message?.includes("does not exist")) {
        console.warn("Branding column not found in tenants table - returning empty settings");
        return {};
      }
      console.error("Error fetching branding settings:", result.error);
      return {};
    }

    return (tenant?.branding as BrandingSettings) || {};
  } catch (error) {
    console.error("Error in getBrandingSettings:", error);
    return {};
  }
}
```

### Function 2: `getThemeSettings()`

**Find this function and REPLACE it with:**

```typescript
export async function getThemeSettings(): Promise<ThemeSettings> {
  try {
    // Check authentication first
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {};
    }

    // Check permission, but don't throw if not authenticated
    try {
      await requirePermission("settings.read");
    } catch {
      return {};
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return {};
    }

    // Check if tenants table exists
    try {
      const tableCheck = await supabase.from("tenants").select("id").limit(1);
      if (tableCheck.error && (tableCheck.error.code === "42P01" || tableCheck.error.message?.includes("does not exist"))) {
        console.warn("Tenants table does not exist yet - returning empty theme settings");
        return {};
      }
    } catch (tableError) {
      console.warn("Could not verify tenants table exists:", tableError);
      return {};
    }

    const result: { data: { theme_settings: Record<string, unknown> | null } | null; error: any } = await supabase
      .from("tenants")
      .select("theme_settings")
      .eq("id", tenantId)
      .single();

    const tenant = result.data;
    if (result.error) {
      // Handle missing column error (column doesn't exist in database yet)
      if (result.error.code === "42703" || result.error.message?.includes("column") || result.error.message?.includes("does not exist")) {
        console.warn("Theme settings column not found in tenants table - returning empty settings");
        return {};
      }
      console.error("Error fetching theme settings:", result.error);
      return {};
    }

    return (tenant?.theme_settings as ThemeSettings) || {};
  } catch (error) {
    console.error("Error in getThemeSettings:", error);
    return {};
  }
}
```

### Function 3: `getEmailSettings()`

**Find this function and REPLACE it with:**

```typescript
export async function getEmailSettings(): Promise<EmailSettings> {
  try {
    // Check authentication first
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {};
    }

    // Check permission, but don't throw if not authenticated
    try {
      await requirePermission("settings.read");
    } catch {
      return {};
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return {};
    }

    // Check if tenants table exists
    try {
      const tableCheck = await supabase.from("tenants").select("id").limit(1);
      if (tableCheck.error && (tableCheck.error.code === "42P01" || tableCheck.error.message?.includes("does not exist"))) {
        console.warn("Tenants table does not exist yet - returning empty email settings");
        return {};
      }
    } catch (tableError) {
      console.warn("Could not verify tenants table exists:", tableError);
      return {};
    }

    const result: { data: { email_settings: Record<string, unknown> | null } | null; error: any } = await supabase
      .from("tenants")
      .select("email_settings")
      .eq("id", tenantId)
      .single();

    const tenant = result.data;
    if (result.error) {
      // Handle missing column error (column doesn't exist in database yet)
      if (result.error.code === "42703" || result.error.message?.includes("column") || result.error.message?.includes("does not exist")) {
        console.warn("Email settings column not found in tenants table - returning empty settings");
        return {};
      }
      return {};
    }

    return (tenant?.email_settings as EmailSettings) || {};
  } catch {
    return {};
  }
}
```

### Function 4: `getCustomCSS()`

**Find this function and REPLACE it with:**

```typescript
export async function getCustomCSS(): Promise<string> {
  try {
    // Check authentication first
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return "";
    }

    // Check permission, but don't throw if not authenticated
    try {
      await requirePermission("settings.read");
    } catch {
      return "";
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return "";
    }

    // Check if tenants table exists
    try {
      const tableCheck = await supabase.from("tenants").select("id").limit(1);
      if (tableCheck.error && (tableCheck.error.code === "42P01" || tableCheck.error.message?.includes("does not exist"))) {
        console.warn("Tenants table does not exist yet - returning empty CSS");
        return "";
      }
    } catch (tableError) {
      console.warn("Could not verify tenants table exists:", tableError);
      return "";
    }

    const result: { data: { custom_css: string | null } | null; error: any } = await supabase
      .from("tenants")
      .select("custom_css")
      .eq("id", tenantId)
      .single();

    const tenant = result.data;
    if (result.error) {
      // Handle missing column error (column doesn't exist in database yet)
      if (result.error.code === "42703" || result.error.message?.includes("column") || result.error.message?.includes("does not exist")) {
        console.warn("Custom CSS column not found in tenants table - returning empty string");
        return "";
      }
      return "";
    }

    return tenant?.custom_css || "";
  } catch {
    return "";
  }
}
```

### Function 5: `getCustomDomains()`

**Find this function and REPLACE it with:**

```typescript
export async function getCustomDomains(): Promise<CustomDomain[]> {
  try {
    // Check authentication first
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return [];
    }

    // Check permission, but don't throw if not authenticated
    try {
      await requirePermission("settings.read");
    } catch {
      return [];
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return [];
    }

    // Check if tenants table exists
    try {
      const tableCheck = await supabase.from("tenants").select("id").limit(1);
      if (tableCheck.error && (tableCheck.error.code === "42P01" || tableCheck.error.message?.includes("does not exist"))) {
        console.warn("Tenants table does not exist yet - returning empty array");
        return [];
      }
    } catch (tableError) {
      console.warn("Could not verify tenants table exists:", tableError);
      return [];
    }

    const result: { data: { custom_domains: unknown[] | null } | null; error: any } = await supabase
      .from("tenants")
      .select("custom_domains")
      .eq("id", tenantId)
      .single();

    const tenant = result.data;
    if (result.error) {
      // Handle missing column error (column doesn't exist in database yet)
      if (result.error.code === "42703" || result.error.message?.includes("column") || result.error.message?.includes("does not exist")) {
        console.warn("Custom domains column not found in tenants table - returning empty array");
        return [];
      }
      return [];
    }

    return (tenant?.custom_domains as unknown as CustomDomain[]) || [];
  } catch {
    return [];
  }
}
```

---

## 📁 FILE 8: Update API Route - Check Platform Admin

**File Path:** `src/app/api/admin/check-platform-admin/route.ts`

**Action:** ADD OPTIONS handler BEFORE the GET function

**Add this code BEFORE `export async function GET()`:**

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
```

**Complete file should look like:**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import { isPlatformAdmin } from "@/app/actions/organization-admins";
import { getUserPermissions } from "@/core/permissions/permissions";

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
  // ... existing GET function code ...
}
```

---

## 📁 FILE 9: Update API Route - Test Tenant Access

**File Path:** `src/app/api/admin/test-tenant-access/route.ts`

**Action:** ADD OPTIONS handler BEFORE the GET function

**Add this code BEFORE `export async function GET()`:**

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
```

---

## 📁 FILE 10: Update API Route - Stripe Webhook

**File Path:** `src/app/api/webhooks/stripe/route.ts`

**Action:** ADD OPTIONS handler BEFORE the POST function

**Add this code BEFORE `export async function POST()`:**

```typescript
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, stripe-signature",
    },
  });
}
```

---

## 📁 FILE 11: Create System Admin Script (Optional)

**File Path:** `scripts/create-system-admin.ts`

**Action:** CREATE NEW FILE (optional utility script)

**Complete Code:**
```typescript
#!/usr/bin/env tsx
/**
 * Script to create a Platform Admin user
 * Run with: npx tsx scripts/create-system-admin.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load environment variables from .env.local
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY is not set in .env.local");
  console.error("\n   Please add to .env.local:");
  console.error("   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key");
  console.error("\n   Get it from: supabase status");
  process.exit(1);
}

async function createSystemAdmin() {
  const email = "systemadmin@tin.info";
  const password = "88888888";
  const fullName = "System Admin";

  console.log(`\n🔧 Creating Platform Admin user: ${email}\n`);

  // Create Supabase admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // 1. Get Platform Admin role ID
    console.log("📋 Step 1: Finding Platform Admin role...");
    const { data: roleData, error: roleError } = await supabase
      .from("roles")
      .select("id, name")
      .eq("name", "Platform Admin")
      .single();

    if (roleError || !roleData) {
      console.error("❌ Error finding Platform Admin role:", roleError);
      console.error("\n   Make sure migrations have been run and Platform Admin role exists.");
      console.error("   Run migrations in Supabase Studio or check the roles table.");
      process.exit(1);
    }

    console.log(`✅ Found Platform Admin role: ${roleData.id}\n`);

    // 2. Check if user already exists in Auth
    console.log("📋 Step 2: Checking if user exists in Auth...");
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error("❌ Error listing users:", listError);
      process.exit(1);
    }

    const existingAuthUser = existingUsers?.users?.find((u) => u.email === email);
    let authUserId: string;

    if (existingAuthUser) {
      console.log(`⚠️  User already exists in Auth: ${existingAuthUser.id}`);
      authUserId = existingAuthUser.id;
    } else {
      // 3. Create user in Supabase Auth
      console.log("📋 Step 3: Creating user in Supabase Auth...");
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: fullName,
        },
      });

      if (authError || !authData.user) {
        console.error("❌ Error creating user in Auth:", authError);
        process.exit(1);
      }

      authUserId = authData.user.id;
      console.log(`✅ Created Auth user: ${authUserId}\n`);
    }

    // 4. Create or update user record in users table
    console.log("📋 Step 4: Creating/updating user record in database...");
    const { data: userData, error: userError } = await supabase
      .from("users")
      .upsert({
        id: authUserId,
        email,
        full_name: fullName,
        tenant_id: null, // Platform Admins have NULL tenant_id
        role_id: roleData.id,
        plan: "enterprise",
        status: "active",
      }, {
        onConflict: "id",
      })
      .select()
      .single();

    if (userError) {
      console.error("❌ Error creating/updating user record:", userError);
      process.exit(1);
    }

    console.log(`\n✅ Platform Admin user created successfully!\n`);
    console.log(`📧 Login Credentials:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}\n`);
    console.log(`👤 User Details:`);
    console.log(`   User ID: ${userData.id}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Full Name: ${userData.full_name}`);
    console.log(`   Role: Platform Admin`);
    console.log(`   Tenant ID: NULL (system-level)\n`);
    console.log(`🎉 You can now sign in at: http://localhost:3001/signin\n`);
  } catch (error: any) {
    console.error("❌ Unexpected error:", error.message);
    console.error(error);
    process.exit(1);
  }
}

createSystemAdmin().catch(console.error);
```

---

## 📋 Implementation Checklist

Copy and apply these changes in order:

1. [ ] **Create `src/app/page.tsx`** - Copy FILE 1 code
2. [ ] **Create `apps/admin/app/page.tsx`** - Copy FILE 2 code (if monorepo)
3. [ ] **Create `apps/admin/app/signin/page.tsx`** - Copy FILE 3 code (if monorepo)
4. [ ] **Update `packages/@tinadmin/core/src/database/client.ts`** - Copy FILE 4 code
5. [ ] **Update `packages/@tinadmin/core/src/database/server.ts`** - Copy FILE 5 code
6. [ ] **Update `src/core/database/server.ts`** - Copy FILE 6 code (if exists)
7. [ ] **Update `src/app/actions/white-label.ts`** - Update 5 functions (FILE 7)
8. [ ] **Update `src/app/api/admin/check-platform-admin/route.ts`** - Add OPTIONS handler (FILE 8)
9. [ ] **Update `src/app/api/admin/test-tenant-access/route.ts`** - Add OPTIONS handler (FILE 9)
10. [ ] **Update `src/app/api/webhooks/stripe/route.ts`** - Add OPTIONS handler (FILE 10)
11. [ ] **Create `scripts/create-system-admin.ts`** - Copy FILE 11 code (optional)

---

## 🔍 Key Patterns to Apply

### Pattern 1: Environment Variable Validation
Always add `.trim()` and validation:
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  // Throw clear error message
}
```

### Pattern 2: Table Existence Check
Before querying columns, check table exists:
```typescript
try {
  const tableCheck = await supabase.from("tenants").select("id").limit(1);
  if (tableCheck.error && (tableCheck.error.code === "42P01" || tableCheck.error.message?.includes("does not exist"))) {
    return {}; // or "" or []
  }
} catch (tableError) {
  return {}; // or "" or []
}
```

### Pattern 3: Column Existence Check
Handle missing columns gracefully:
```typescript
if (result.error) {
  if (result.error.code === "42703" || result.error.message?.includes("column") || result.error.message?.includes("does not exist")) {
    return {}; // or "" or []
  }
  return {}; // or "" or []
}
```

### Pattern 4: CORS OPTIONS Handler
Add to all API routes:
```typescript
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS", // or "POST, OPTIONS"
      "Access-Control-Allow-Headers": "Content-Type", // add more as needed
    },
  });
}
```

---

## ✅ Testing After Changes

1. Test root route (`/`) - should redirect correctly
2. Test signin page (`/signin`) - should load without 404
3. Test API routes with OPTIONS request - should return 204
4. Test white label settings - should load without errors
5. Test with empty database - should work gracefully

---

## 📝 Notes

- **Monorepo**: If using a monorepo, copy `.env.local` to each app directory
- **Error Codes**: PostgreSQL error codes handled:
  - `42703` = Undefined column
  - `42P01` = Undefined table
- **Server Actions**: POST errors to routes are expected Next.js behavior (not a bug)

---

## 🎯 Summary

**Files Created:** 3-4 new files (root pages, signin page, optional script)
**Files Modified:** 7 files (clients, white label, API routes)
**Total Changes:** ~500 lines of code

All code is ready to copy and paste directly into your codebase!
