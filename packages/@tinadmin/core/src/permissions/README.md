# 🔒 PERMISSIONS DOMAIN

Central permissions and RBAC (Role-Based Access Control) module.

## 📁 Structure

```
permissions/
├── index.ts                 # PUBLIC API - Import only from here!
├── permissions.ts           # Server-side permission checking
├── permissions-client.ts    # Client-side permission checking
├── gates.tsx                # React permission gates
├── middleware.ts            # Permission middleware
├── tenant-permissions.ts    # Tenant-scoped permissions
└── actions.ts               # Server actions
```

## 🎯 Purpose

This domain handles:
- ✅ Role-Based Access Control (RBAC)
- ✅ Permission checking (server + client)
- ✅ Permission gates (conditional rendering)
- ✅ Permission middleware (API protection)
- ✅ Tenant-scoped permissions
- ✅ Audit logging of permission checks

## 📦 Public API

### Server-Side Permission Checking

```typescript
import { 
  getUserPermissions,
  hasPermission,
  requirePermission 
} from '@/core/permissions';

// Get all permissions for a user
const permissions = await getUserPermissions(userId);

// Check if user has a permission
if (await hasPermission(userId, 'users.write')) {
  // Allow action
}

// Require permission (throws if not allowed)
await requirePermission('billing.write');
```

### Client-Side Permission Checking

```typescript
import { hasPermissionClient } from '@/core/permissions';

// In a client component
const canEdit = await hasPermissionClient('users.write');
```

### React Permission Gates

```typescript
import { PermissionGate } from '@/core/permissions';

function MyComponent() {
  return (
    <>
      <PermissionGate permission="users.write">
        <button>Edit User</button>
      </PermissionGate>
      
      <PermissionGate 
        permission="users.delete"
        fallback={<p>No access</p>}
      >
        <button>Delete User</button>
      </PermissionGate>
    </>
  );
}
```

### Multiple Permissions

```typescript
import { 
  PermissionAnyGate,
  PermissionAllGate 
} from '@/core/permissions';

// Require ANY of the permissions
<PermissionAnyGate permissions={['users.write', 'users.delete']}>
  <button>Manage Users</button>
</PermissionAnyGate>

// Require ALL permissions
<PermissionAllGate permissions={['billing.read', 'billing.write']}>
  <button>Manage Billing</button>
</PermissionAllGate>
```

### Role-Based Gates

```typescript
import { RoleGate } from '@/core/permissions';

<RoleGate roles={['Platform Admin', 'Organization Admin']}>
  <AdminPanel />
</RoleGate>
```

### API Route Protection

```typescript
import { requirePermission } from '@/core/permissions';

export async function POST(request: Request) {
  // Will throw 403 if user lacks permission
  await requirePermission('users.write');
  
  // Protected code here
  const user = await createUser(...);
  return Response.json(user);
}
```

### Server Action Protection

```typescript
"use server";

import { requirePermission } from '@/core/permissions';

export async function deleteUserAction(userId: string) {
  await requirePermission('users.delete');
  
  // Protected action
  await deleteUser(userId);
}
```

### Middleware HOC

```typescript
import { withPermission } from '@/core/permissions';

const protectedFunction = withPermission(
  'billing.write',
  async (data) => {
    // This only runs if user has permission
    return await updateBilling(data);
  }
);
```

## 🎭 Permission Model

### Permission Format

```
<resource>.<action>

Examples:
- users.read      → View users
- users.write     → Create/edit users
- users.delete    → Delete users
- billing.write   → Manage billing
```

### Wildcard Permissions

```typescript
// Grant all user permissions
'users.*'  → Matches: users.read, users.write, users.delete

// Grant everything
'*'  → Matches all permissions
```

### Role Hierarchy

```
Platform Admin
  └─ All permissions (*)

Organization Admin
  └─ Tenant-scoped permissions
     ├─ users.*
     ├─ billing.*
     ├─ settings.*
     └─ etc.

User
  └─ Limited permissions
     ├─ users.read
     ├─ billing.read
     └─ settings.read

Guest
  └─ Minimal permissions
     └─ settings.read
```

## 🔄 Dependencies

### This domain depends on:
- **Auth**: User identification
- **Multi-Tenancy**: Tenant context
- **Database**: User roles and permissions

### Other domains depend on this for:
- **All domains**: Access control
- **UI Components**: Conditional rendering
- **API Routes**: Authorization

## 🏗️ Database Schema

```sql
-- Roles table
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions TEXT[] -- Array of permission strings
);

-- User roles (primary role)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  role_id UUID REFERENCES roles(id)
);

-- User tenant roles (additional roles per tenant)
CREATE TABLE user_tenant_roles (
  user_id UUID REFERENCES users(id),
  tenant_id UUID REFERENCES tenants(id),
  role_id UUID REFERENCES roles(id),
  PRIMARY KEY (user_id, tenant_id)
);
```

## 🎯 Permission Resolution

### Priority Order

1. **Platform Admin** - Global access (tenant_id = NULL)
2. **Tenant Role** - Tenant-specific role (from user_tenant_roles)
3. **Primary Role** - User's default role (from users.role_id)

```typescript
async function getEffectiveRole(userId, tenantId) {
  // 1. Check if Platform Admin
  const user = await getUser(userId);
  if (user.role.name === 'Platform Admin' && !user.tenant_id) {
    return 'Platform Admin';
  }
  
  // 2. Check tenant-specific role
  const tenantRole = await getUserTenantRole(userId, tenantId);
  if (tenantRole) {
    return tenantRole.name;
  }
  
  // 3. Fall back to primary role
  return user.role.name;
}
```

## 💡 Best Practices

1. **Always check permissions** before sensitive operations
   ```typescript
   // ✅ CORRECT
   await requirePermission('users.delete');
   await deleteUser(userId);
   
   // ❌ WRONG - No permission check!
   await deleteUser(userId);
   ```

2. **Use permission gates** for UI elements
   ```typescript
   // ✅ CORRECT
   <PermissionGate permission="users.write">
     <EditButton />
   </PermissionGate>
   
   // ❌ WRONG - Button visible to all
   <EditButton />
   ```

3. **Use wildcards** for broad permissions
   ```typescript
   // Admin needs all user permissions
   role.permissions = ['users.*']
   
   // Instead of:
   role.permissions = ['users.read', 'users.write', 'users.delete']
   ```

4. **Log permission checks** for auditing
   ```typescript
   // Automatically logged by requirePermission()
   await requirePermission('billing.write');
   ```

5. **Handle permission errors gracefully**
   ```typescript
   try {
     await requirePermission('users.delete');
     await deleteUser(userId);
   } catch (error) {
     // Show user-friendly error
     toast.error('You do not have permission to delete users');
   }
   ```

## ⚠️ Important Rules

1. **DO NOT** import internal files directly
   ```typescript
   // ❌ WRONG
   import { something } from '@/core/permissions/permissions';
   
   // ✅ CORRECT
   import { something } from '@/core/permissions';
   ```

2. **NEVER** check permissions on the client side alone
   - Always verify on the server

3. **ALWAYS** use `requirePermission` for API routes and server actions

4. **DO NOT** hardcode permission checks
   ```typescript
   // ❌ WRONG
   if (user.role === 'Admin') { ... }
   
   // ✅ CORRECT
   if (await hasPermission(userId, 'users.write')) { ... }
   ```

## 🧪 Testing

```typescript
// Mock permissions for testing
import { getUserPermissions } from '@/core/permissions';

jest.mock('@/core/permissions', () => ({
  getUserPermissions: jest.fn().mockResolvedValue({
    'users.read': true,
    'users.write': true,
  }),
  hasPermission: jest.fn().mockResolvedValue(true),
}));
```

## 📝 Adding New Permissions

1. Add to `PERMISSIONS` constant in `index.ts`
2. Update `ROLE_PERMISSIONS` if needed
3. Add permission checks where needed
4. Update role configurations in database
5. Test thoroughly

```typescript
// 1. Add permission
export const PERMISSIONS = {
  ...existing,
  'reports.export': 'Export reports',
};

// 2. Add to roles
export const ROLE_PERMISSIONS = {
  'Platform Admin': [...existing, 'reports.export'],
};

// 3. Use in code
await requirePermission('reports.export');
```

## 📚 Additional Resources

- [RBAC Overview](https://en.wikipedia.org/wiki/Role-based_access_control)
- [OWASP Access Control Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html)
- [Multi-Role Architecture Doc](../../docs/MULTI_ROLE_ARCHITECTURE.md)




