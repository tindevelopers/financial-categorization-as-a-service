# 🗄️ DATABASE DOMAIN

Central database module for the SaaS platform.

## 📁 Structure

```
database/
├── index.ts                 # PUBLIC API - Import only from here!
├── types.ts                 # TypeScript types (generated from DB)
├── server.ts                # Server-side client
├── client.ts                # Client-side client
├── admin-client.ts          # Admin client (bypasses RLS)
├── tenant-client.ts         # Tenant-aware client
├── users.ts                 # User data access
├── tenants.ts               # Tenant data access
├── roles.ts                 # Role data access
├── workspaces.ts            # Workspace data access
├── user-tenant-roles.ts     # User-tenant role junction
├── organization-admins.ts   # Organization admin management
└── migrations.sql           # Database migrations
```

## 🎯 Purpose

This domain handles:
- ✅ Database client management (Supabase)
- ✅ TypeScript type definitions
- ✅ Data access layer (DAL)
- ✅ User, tenant, role management
- ✅ Query utilities
- ✅ Database migrations

## 📦 Public API

### Server-Side Database Access

```typescript
import { createClient, createAdminClient } from '@/core/database';

// In Server Components or Server Actions
const supabase = await createClient();
const { data: users } = await supabase.from('users').select('*');

// Admin operations (bypasses RLS)
const adminClient = createAdminClient();
const { data: allData } = await adminClient.from('tenants').select('*');
```

### Client-Side Database Access

```typescript
import { createBrowserClient } from '@/core/database';

// In Client Components
const supabase = createBrowserClient();
const { data: profile } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .single();
```

### Tenant-Aware Database Access

```typescript
import { createTenantClient } from '@/core/database';

// Automatically filters by current tenant
const supabase = await createTenantClient();
const { data: orders } = await supabase.from('orders').select('*');
// Only returns orders for the current tenant
```

### User Management

```typescript
import {
  getUser,
  createUser,
  updateUser,
  listUsers
} from '@/core/database';

// Get a user
const user = await getUser(userId);

// Create a user
const newUser = await createUser({
  email: 'user@example.com',
  full_name: 'John Doe',
  tenant_id: tenantId,
  role_id: roleId,
});

// List users for a tenant
const users = await listUsers(tenantId);
```

### Tenant Management

```typescript
import {
  getTenant,
  createTenant,
  listTenants
} from '@/core/database';

// Get a tenant
const tenant = await getTenant(tenantId);

// Create a tenant
const newTenant = await createTenant({
  name: 'Acme Corp',
  domain: 'acme',
  status: 'active',
});
```

### Role Management

```typescript
import {
  getRole,
  getRoleByName,
  listRoles
} from '@/core/database';

// Get a role
const role = await getRole(roleId);

// Get role by name
const adminRole = await getRoleByName('Platform Admin');

// List all roles
const roles = await listRoles();
```

## 🔧 Database Clients

### 1. Server Client (createClient)

```typescript
import { createClient } from '@/core/database';

// ✅ Use in:
// - Server Components
// - Server Actions
// - API Routes

// ❌ DO NOT use in:
// - Client Components

const supabase = await createClient();
```

**Features:**
- SSR-aware (works with Next.js cookies)
- Respects RLS policies
- User-scoped queries

### 2. Browser Client (createBrowserClient)

```typescript
import { createBrowserClient } from '@/core/database';

// ✅ Use in:
// - Client Components
// - React hooks

// ❌ DO NOT use in:
// - Server Components
// - Server Actions

const supabase = createBrowserClient();
```

**Features:**
- Browser-based session management
- Respects RLS policies
- Real-time subscriptions

### 3. Admin Client (createAdminClient)

```typescript
import { createAdminClient } from '@/core/database';

// ✅ Use in:
// - Admin Server Actions
// - Background jobs
// - System operations

// ❌ DO NOT use in:
// - Client Components
// - Regular API routes
// - NEVER expose to browser!

const adminClient = createAdminClient();
```

**Features:**
- **Bypasses RLS** (full database access)
- Service role key
- Use with extreme caution!

### 4. Tenant Client (createTenantClient)

```typescript
import { createTenantClient } from '@/core/database';

// Automatically filters by current tenant
const supabase = await createTenantClient();
const { data } = await supabase.from('orders').select('*');
// Returns only current tenant's orders
```

**Features:**
- Tenant context aware
- Automatic tenant filtering
- Prevents data leakage

## 🏗️ Database Schema

### Core Tables

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  tenant_id UUID REFERENCES tenants(id),
  role_id UUID REFERENCES roles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  status TEXT DEFAULT 'active',
  branding JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Roles
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions TEXT[]
);

-- User Tenant Roles (Multi-role junction table)
CREATE TABLE user_tenant_roles (
  user_id UUID REFERENCES users(id),
  tenant_id UUID REFERENCES tenants(id),
  role_id UUID REFERENCES roles(id),
  PRIMARY KEY (user_id, tenant_id)
);
```

### Row-Level Security (RLS)

```sql
-- Example RLS policy
CREATE POLICY "Users can only access their tenant's data"
  ON orders
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );
```

## 🔄 Dependencies

### This domain depends on:
- **Supabase**: Database provider
- **Environment**: Configuration

### Other domains depend on this for:
- **All domains**: Data persistence
- **Auth**: User storage
- **Multi-Tenancy**: Tenant storage
- **Permissions**: Role storage
- **Billing**: Subscription storage

## 💡 Best Practices

1. **Use the correct client** for your context
   ```typescript
   // ✅ Server Component
   const supabase = await createClient();
   
   // ✅ Client Component
   const supabase = createBrowserClient();
   
   // ✅ Admin operation
   const adminClient = createAdminClient();
   ```

2. **Always handle errors**
   ```typescript
   const { data, error } = await supabase.from('users').select('*');
   
   if (error) {
     console.error('Database error:', error);
     throw new Error('Failed to fetch users');
   }
   ```

3. **Use TypeScript types**
   ```typescript
   import type { Database } from '@/core/database';
   
   type User = Database['public']['Tables']['users']['Row'];
   type UserInsert = Database['public']['Tables']['users']['Insert'];
   ```

4. **Leverage RLS** instead of manual filtering
   ```typescript
   // ✅ CORRECT - RLS handles tenant filtering
   const { data } = await supabase.from('orders').select('*');
   
   // ❌ WRONG - Manual filtering is error-prone
   const { data } = await supabase
     .from('orders')
     .select('*')
     .eq('tenant_id', tenantId);
   ```

5. **Use tenant-aware client** for tenant-scoped operations
   ```typescript
   const supabase = await createTenantClient();
   // All queries automatically filtered by tenant
   ```

## ⚠️ Important Rules

1. **DO NOT** import internal files directly
   ```typescript
   // ❌ WRONG
   import { something } from '@/core/database/users';
   
   // ✅ CORRECT
   import { something } from '@/core/database';
   ```

2. **NEVER** use admin client in client-side code

3. **ALWAYS** respect RLS policies

4. **NEVER** disable RLS unless absolutely necessary

5. **ALWAYS** validate input before database operations

## 🔐 Security Considerations

### Admin Client Usage

```typescript
// ⚠️ DANGER ZONE
import { createAdminClient } from '@/core/database';

// Only use admin client when:
// 1. You need to bypass RLS for system operations
// 2. You're in a secure server-side context
// 3. You've validated user permissions separately

const adminClient = createAdminClient();

// Example: Platform Admin viewing all tenants
await requirePermission('tenants.read'); // Check permission first!
const { data: allTenants } = await adminClient.from('tenants').select('*');
```

### RLS Bypass

```typescript
// If you must bypass RLS, document WHY
const adminClient = createAdminClient();

// REASON: System-level operation to sync all users
const { data: users } = await adminClient.from('users').select('*');
```

## 🧪 Testing

```typescript
// Mock database client
jest.mock('@/core/database', () => ({
  createClient: jest.fn().mockResolvedValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    }),
  }),
}));
```

## 📝 Migrations

### Running Migrations

```bash
# Apply all migrations
supabase db push

# Reset database (DEV ONLY!)
supabase db reset

# Create a new migration
supabase migration new my_migration_name
```

### Migration Best Practices

1. Always include `IF NOT EXISTS` checks
2. Make migrations idempotent
3. Test on staging first
4. Document breaking changes
5. Include rollback plan

## 📚 Additional Resources

- [Supabase Docs](https://supabase.com/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Row-Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [TypeScript Type Generation](https://supabase.com/docs/guides/api/generating-types)




