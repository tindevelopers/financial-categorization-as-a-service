# Platform Admin vs Organization Admin Architecture

## Overview

This document outlines the recommended architecture for separating **Platform Admins** (system-level) from **Organization Admins** (tenant-level) and enabling Platform Admins to view all Organization Admins across all tenants.

## 🏗️ Recommended Architecture

### User Hierarchy

```
Platform Level (System)
├── Platform Admin (systemadmin@tin.info)
│   ├── Can see ALL tenants
│   ├── Can see ALL Organization Admins
│   ├── Can manage system-wide settings
│   └── tenant_id = NULL (system-level user)
│
Tenant Level (Organizations)
├── Tenant A (Acme Corp)
│   ├── Organization Admin (admin@acme.com) - tenant_id = Tenant A
│   │   ├── Can manage Tenant A users
│   │   ├── Can configure Tenant A settings
│   │   └── Role: "Workspace Admin"
│   └── Regular Users (user1@acme.com, user2@acme.com)
│
├── Tenant B (TechStart Inc)
│   ├── Organization Admin (admin@techstart.com) - tenant_id = Tenant B
│   └── Regular Users
│
└── Tenant C (Global Corp)
    ├── Organization Admin (admin@global.com) - tenant_id = Tenant C
    └── Regular Users
```

## 📊 Database Schema Changes

### Option 1: Platform Admins with NULL tenant_id (RECOMMENDED)

**Pros:**
- Clean separation between system and tenant users
- Easy to query: Platform Admins = `WHERE tenant_id IS NULL`
- Clear data model
- Platform Admins don't clutter tenant user lists

**Cons:**
- Need to handle NULL tenant_id in queries
- RLS policies need special handling

**Implementation:**

```sql
-- Users table already supports tenant_id = NULL
-- Platform Admins: tenant_id = NULL, role_id = Platform Admin role
-- Organization Admins: tenant_id = <tenant_id>, role_id = Workspace Admin role

-- Example:
-- Platform Admin
INSERT INTO users (id, email, full_name, role_id, tenant_id, plan, status)
VALUES (
  'user-uuid',
  'systemadmin@tin.info',
  'System Admin',
  (SELECT id FROM roles WHERE name = 'Platform Admin'),
  NULL,  -- No tenant - system-level
  'platform',
  'active'
);

-- Organization Admin
INSERT INTO users (id, email, full_name, role_id, tenant_id, plan, status)
VALUES (
  'user-uuid',
  'admin@acme.com',
  'Acme Admin',
  (SELECT id FROM roles WHERE name = 'Workspace Admin'),
  'tenant-uuid',  -- Belongs to tenant
  'enterprise',
  'active'
);
```

### Option 2: Special "System" Tenant

**Pros:**
- All users have a tenant_id (no NULL handling)
- Simpler queries

**Cons:**
- Platform Admins appear in tenant lists
- Less clear separation
- Need to filter out system tenant everywhere

**Implementation:**

```sql
-- Create a special system tenant
INSERT INTO tenants (id, name, domain, plan, region, status)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'System',
  'system',
  'platform',
  'global',
  'active'
);

-- Platform Admins belong to system tenant
-- Organization Admins belong to their tenant
```

## ✅ Recommended Approach: Option 1 (NULL tenant_id)

### Why Option 1?

1. **Clear Separation**: Platform Admins are clearly system-level, not tenant-level
2. **Better Queries**: Easy to filter tenant users vs platform users
3. **Cleaner UI**: Platform Admins don't appear in tenant user lists
4. **Scalability**: No need to filter out a "system" tenant everywhere

## 🔧 Implementation Plan

### Phase 1: Database Schema Updates

1. **Update Platform Admin Users**
   ```sql
   -- Set existing Platform Admins to tenant_id = NULL
   UPDATE users
   SET tenant_id = NULL
   WHERE role_id IN (SELECT id FROM roles WHERE name = 'Platform Admin');
   ```

2. **Add Constraint** (Optional but recommended)
   ```sql
   -- Add check constraint: Platform Admins must have NULL tenant_id
   ALTER TABLE users
   ADD CONSTRAINT platform_admin_no_tenant
   CHECK (
     (role_id IN (SELECT id FROM roles WHERE name = 'Platform Admin') AND tenant_id IS NULL)
     OR
     (role_id NOT IN (SELECT id FROM roles WHERE name = 'Platform Admin'))
   );
   ```

3. **Create View for Organization Admins**
   ```sql
   CREATE OR REPLACE VIEW organization_admins AS
   SELECT 
     u.id,
     u.email,
     u.full_name,
     u.status,
     u.created_at,
     u.last_active_at,
     t.id as tenant_id,
     t.name as tenant_name,
     t.domain as tenant_domain,
     r.name as role_name,
     r.permissions
   FROM users u
   JOIN tenants t ON u.tenant_id = t.id
   JOIN roles r ON u.role_id = r.id
   WHERE r.name = 'Workspace Admin'
   ORDER BY t.name, u.created_at;
   ```

### Phase 2: Update RLS Policies

```sql
-- Platform Admins can see all Organization Admins (Workspace Admins)
CREATE POLICY "Platform admins can view all organization admins"
  ON users FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- User is Platform Admin
      EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid()
        AND r.name = 'Platform Admin'
        AND u.tenant_id IS NULL
      )
      OR
      -- User is viewing their own tenant's admins
      (
        tenant_id IN (
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
        AND role_id IN (SELECT id FROM roles WHERE name = 'Workspace Admin')
      )
    )
  );
```

### Phase 3: Create Helper Functions

```typescript
// src/lib/supabase/organization-admins.ts

import { createClient } from "./client";
import { createAdminClient } from "./admin-client";
import type { Database } from "./types";

type OrganizationAdmin = Database["public"]["Tables"]["users"]["Row"] & {
  roles?: { name: string } | null;
  tenants?: { name: string; domain: string } | null;
};

/**
 * Get all Organization Admins (Workspace Admins) across all tenants
 * Only accessible by Platform Admins
 */
export async function getAllOrganizationAdmins() {
  const supabase = createClient();
  
  // Check if current user is Platform Admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: currentUser } = await supabase
    .from("users")
    .select("role_id, tenant_id, roles:role_id(name)")
    .eq("id", user.id)
    .single();

  const isPlatformAdmin = 
    (currentUser?.roles as any)?.name === "Platform Admin" &&
    currentUser?.tenant_id === null;

  if (!isPlatformAdmin) {
    throw new Error("Only Platform Admins can view all Organization Admins");
  }

  // Get all Workspace Admins with tenant info
  const { data, error } = await supabase
    .from("users")
    .select(`
      *,
      roles:role_id (
        id,
        name,
        description,
        permissions
      ),
      tenants:tenant_id (
        id,
        name,
        domain,
        status
      )
    `)
    .eq("roles.name", "Workspace Admin")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as OrganizationAdmin[];
}

/**
 * Get Organization Admins for a specific tenant
 * Accessible by Platform Admins and tenant admins
 */
export async function getTenantOrganizationAdmins(tenantId: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from("users")
    .select(`
      *,
      roles:role_id (
        id,
        name,
        description,
        permissions
      ),
      tenants:tenant_id (
        id,
        name,
        domain
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("roles.name", "Workspace Admin")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as OrganizationAdmin[];
}
```

### Phase 4: Create UI Page

```typescript
// src/app/saas/admin/system-admin/organization-admins/page.tsx

"use client";

import { useEffect, useState } from "react";
import { getAllOrganizationAdmins } from "@/lib/supabase/organization-admins";
import type { Database } from "@/lib/supabase/types";

type OrgAdmin = Database["public"]["Tables"]["users"]["Row"] & {
  roles?: { name: string } | null;
  tenants?: { name: string; domain: string } | null;
};

export default function OrganizationAdminsPage() {
  const [admins, setAdmins] = useState<OrgAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const data = await getAllOrganizationAdmins();
      setAdmins(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admins");
    } finally {
      setLoading(false);
    }
  };

  // Group admins by tenant
  const adminsByTenant = admins.reduce((acc, admin) => {
    const tenantName = (admin.tenants as any)?.name || "Unknown";
    if (!acc[tenantName]) {
      acc[tenantName] = [];
    }
    acc[tenantName].push(admin);
    return acc;
  }, {} as Record<string, OrgAdmin[]>);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold mb-2">Organization Admins</h1>
        <p className="text-gray-600">
          View all Organization Admins (Workspace Admins) across all tenants
        </p>
      </section>

      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(adminsByTenant).map(([tenantName, tenantAdmins]) => (
            <div key={tenantName} className="rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold mb-4">{tenantName}</h2>
              <div className="space-y-2">
                {tenantAdmins.map((admin) => (
                  <div key={admin.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{admin.full_name}</p>
                      <p className="text-sm text-gray-600">{admin.email}</p>
                    </div>
                    <div className="text-sm text-gray-500">
                      {admin.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## 📋 Migration Steps

### Step 1: Update Existing Platform Admins

```sql
-- Migration: 20251204220011_set_platform_admins_tenant_null.sql

-- Set Platform Admins to tenant_id = NULL
UPDATE users
SET tenant_id = NULL
WHERE role_id IN (
  SELECT id FROM roles WHERE name = 'Platform Admin'
)
AND tenant_id IS NOT NULL;

-- Verify
SELECT 
  u.email,
  u.full_name,
  r.name as role_name,
  u.tenant_id,
  t.name as tenant_name
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE r.name = 'Platform Admin';
```

### Step 2: Update Sign-up Flow

```typescript
// src/app/actions/auth.ts

// When creating Platform Admin, set tenant_id = NULL
if (roleName === "Platform Admin") {
  userData.tenant_id = null; // Platform Admins don't belong to tenants
} else {
  userData.tenant_id = tenant.id; // Other users belong to tenant
}
```

### Step 3: Update RLS Policies

```sql
-- Update user policies to handle Platform Admins with NULL tenant_id
-- Platform Admins can see all users
-- Organization Admins can see their tenant's users
```

## 🎯 Key Benefits

1. **Clear Separation**: Platform Admins are system-level, Organization Admins are tenant-level
2. **Easy Querying**: Simple to get all Organization Admins: `WHERE role = 'Workspace Admin' AND tenant_id IS NOT NULL`
3. **Better Security**: Platform Admins clearly separated from tenant data
4. **Scalable**: Easy to add more system-level roles in the future
5. **Clean UI**: Platform Admins don't appear in tenant user lists

## 🔍 Query Examples

### Get All Organization Admins (Platform Admin View)

```sql
SELECT 
  u.*,
  t.name as tenant_name,
  t.domain as tenant_domain
FROM users u
JOIN tenants t ON u.tenant_id = t.id
JOIN roles r ON u.role_id = r.id
WHERE r.name = 'Workspace Admin'
ORDER BY t.name, u.created_at;
```

### Get Platform Admins Only

```sql
SELECT u.*
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE r.name = 'Platform Admin'
AND u.tenant_id IS NULL;
```

### Get Tenant Users (Excluding Platform Admins)

```sql
SELECT u.*
FROM users u
WHERE u.tenant_id = 'tenant-uuid'
AND u.role_id NOT IN (
  SELECT id FROM roles WHERE name = 'Platform Admin'
);
```

## 📝 Summary

**Recommended Approach:**
- ✅ Platform Admins: `tenant_id = NULL`, `role = 'Platform Admin'`
- ✅ Organization Admins: `tenant_id = <tenant_id>`, `role = 'Workspace Admin'`
- ✅ Create view/query to show all Organization Admins grouped by tenant
- ✅ Update RLS policies to allow Platform Admins to see all Organization Admins
- ✅ Create UI page for Platform Admins to view all Organization Admins

This architecture provides clear separation, easy querying, and scalable design for your multi-tenant system.

