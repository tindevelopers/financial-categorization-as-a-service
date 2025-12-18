# 🚀 Quick Start Guide - Core Domains

**5-Minute Guide to Using the New Core Structure**

---

## 📦 Basic Imports

### Authentication

```typescript
// Sign in / Sign up
import { signIn, signUp, signOut } from '@/core/auth';

await signIn('user@example.com', 'password');
```

### Get Current User

```typescript
import { getCurrentUser } from '@/core/auth';

const user = await getCurrentUser();
console.log(user.email);
```

### Get Current Tenant

```typescript
import { getCurrentTenant } from '@/core/multi-tenancy';

const tenant = await getCurrentTenant();
console.log(tenant.name);
```

### Check Permissions

```typescript
import { hasPermission, requirePermission } from '@/core/permissions';

// Check if user has permission
if (await hasPermission('users.write')) {
  // Allow action
}

// Require permission (throws if not allowed)
await requirePermission('billing.write');
```

### Permission Gates (React)

```typescript
import { PermissionGate } from '@/core/permissions';

function MyComponent() {
  return (
    <PermissionGate permission="users.write">
      <button>Edit User</button>
    </PermissionGate>
  );
}
```

### Database Access

```typescript
// Server-side
import { createClient } from '@/core/database';

const supabase = await createClient();
const { data } = await supabase.from('users').select('*');

// Client-side
import { createBrowserClient } from '@/core/database';

const supabase = createBrowserClient();
```

### Billing

```typescript
import { createCheckoutSession, getActiveSubscription } from '@/core/billing';

// Create checkout
const { url } = await createCheckoutSession(
  tenantId,
  priceId,
  '/success',
  '/cancel'
);

// Get subscription
const { subscription } = await getActiveSubscription(tenantId);
```

---

## 🎯 Common Patterns

### Server Action with Permission Check

```typescript
"use server";

import { requirePermission } from '@/core/permissions';
import { createClient } from '@/core/database';

export async function deleteUserAction(userId: string) {
  // Check permission
  await requirePermission('users.delete');
  
  // Perform action
  const supabase = await createClient();
  await supabase.from('users').delete().eq('id', userId);
  
  return { success: true };
}
```

### Protected Page Component

```typescript
import { PermissionGate } from '@/core/permissions';
import { getCurrentUser, getCurrentTenant } from '@/core';

export default async function UsersPage() {
  const user = await getCurrentUser();
  const tenant = await getCurrentTenant();
  
  return (
    <div>
      <h1>Users for {tenant.name}</h1>
      
      <PermissionGate permission="users.write">
        <button>Add User</button>
      </PermissionGate>
      
      {/* User list */}
    </div>
  );
}
```

### Tenant-Aware Query

```typescript
import { createTenantClient } from '@/core/database';

// Automatically filtered by current tenant
const supabase = await createTenantClient();
const { data: orders } = await supabase.from('orders').select('*');
// Only returns current tenant's orders
```

---

## 📚 Need More?

- **Full Documentation:** See [Core README](./README.md)
- **Domain-Specific:** Read domain READMEs (e.g., [Auth README](./auth/README.md))
- **Dependencies:** See [DEPENDENCIES.md](../../docs/DEPENDENCIES.md)
- **Migration Guide:** See [CORE_REORGANIZATION_SUMMARY.md](../../docs/CORE_REORGANIZATION_SUMMARY.md)

---

## ⚠️ Important Rules

1. **ALWAYS** import from `@/core` or `@/core/{domain}`
2. **NEVER** import internal files (e.g., `@/core/auth/supabase-provider`)
3. **CHECK** permissions before sensitive operations
4. **USE** the right client (server vs. browser vs. admin)

---

**Happy coding! 🎉**




