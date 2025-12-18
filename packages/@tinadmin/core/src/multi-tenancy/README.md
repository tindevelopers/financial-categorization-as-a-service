# 🏢 MULTI-TENANCY DOMAIN

Central multi-tenancy module for the SaaS platform.

## 📁 Structure

```
multi-tenancy/
├── index.ts                # PUBLIC API - Import only from here!
├── types.ts                # TypeScript types
├── context.ts              # Tenant context (client + server)
├── context.tsx             # React context provider
├── resolver.ts             # Tenant resolution strategies
├── validation.ts           # Tenant access validation
├── subdomain-routing.ts    # Subdomain-based routing
├── query-builder.ts        # Tenant-aware database queries
├── server.ts               # Server-side utilities
├── actions.ts              # Server actions for tenants
├── tenant-roles.ts         # Tenant role management
├── workspaces.ts           # Workspace management
└── white-label.ts          # White-label settings
```

## 🎯 Purpose

This domain handles:
- ✅ Tenant isolation (database RLS, queries)
- ✅ Tenant context management
- ✅ Tenant resolution (subdomain, header, path)
- ✅ Subdomain routing
- ✅ Tenant-aware database queries
- ✅ White-label customization
- ✅ Workspace management
- ✅ Tenant role assignments

## 📦 Public API

### Tenant Context (Client-Side)

```typescript
import { TenantProvider, useTenant } from '@/core/multi-tenancy';

// In your app layout
<TenantProvider>
  <YourApp />
</TenantProvider>

// In a component
function MyComponent() {
  const { tenant, loading } = useTenant();
  return <div>Tenant: {tenant?.name}</div>;
}
```

### Tenant Resolution (Server-Side)

```typescript
import { 
  resolveTenantFromRequest,
  getCurrentTenant 
} from '@/core/multi-tenancy';

// In a server component or API route
const tenant = await getCurrentTenant();

// From a Next.js request
const tenant = await resolveTenantFromRequest(request);
```

### Tenant-Aware Queries

```typescript
import { createTenantQuery, applyTenantFilter } from '@/core/multi-tenancy';

// Automatically filter by current tenant
const query = createTenantQuery(supabase, 'orders');
const { data } = await query.select('*');

// Manual filter
const filtered = applyTenantFilter(supabase.from('orders'), tenantId);
```

### White-Label Settings

```typescript
import { 
  getBrandingSettings,
  saveBrandingSettings 
} from '@/core/multi-tenancy';

// Get branding
const branding = await getBrandingSettings(tenantId);

// Save branding
await saveBrandingSettings(tenantId, {
  logo: '/logo.png',
  primaryColor: '#3B82F6',
  companyName: 'Acme Corp'
});
```

## 🔄 Tenant Resolution Strategies

### 1. Subdomain-Based (Recommended)

```
tenant1.yourapp.com → Tenant: tenant1
tenant2.yourapp.com → Tenant: tenant2
```

Configuration:
```env
NEXT_PUBLIC_TENANT_RESOLUTION=subdomain
NEXT_PUBLIC_BASE_DOMAIN=yourapp.com
```

### 2. Header-Based

```
X-Tenant-ID: tenant-uuid-here
```

Configuration:
```env
NEXT_PUBLIC_TENANT_RESOLUTION=header
NEXT_PUBLIC_TENANT_HEADER=X-Tenant-ID
```

### 3. Path-Based

```
yourapp.com/tenant1/dashboard → Tenant: tenant1
yourapp.com/tenant2/dashboard → Tenant: tenant2
```

Configuration:
```env
NEXT_PUBLIC_TENANT_RESOLUTION=path
```

### 4. Query Parameter

```
yourapp.com/dashboard?tenant=tenant1
```

Configuration:
```env
NEXT_PUBLIC_TENANT_RESOLUTION=query
```

## 🔄 Dependencies

### This domain depends on:
- **Auth**: User identification for tenant access
- **Database**: Tenant storage and queries
- **Permissions**: Tenant-level permissions

### Other domains depend on this for:
- **Billing**: Tenant-specific subscriptions
- **Permissions**: Tenant context for RBAC
- **Auth**: Tenant association for users

## 🏗️ Database Schema

```sql
-- Tenants table
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  status TEXT, -- 'active', 'suspended', 'trial'
  branding JSONB,
  theme_settings JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User-Tenant association
CREATE TABLE user_tenant_roles (
  user_id UUID REFERENCES users(id),
  tenant_id UUID REFERENCES tenants(id),
  role_id UUID REFERENCES roles(id),
  PRIMARY KEY (user_id, tenant_id)
);
```

## 🛡️ Row-Level Security (RLS)

All tenant-aware tables should have RLS policies:

```sql
-- Example RLS policy
CREATE POLICY "Users can only access their tenant's data"
  ON orders
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

## 🚀 Best Practices

1. **Always use tenant-aware queries** for multi-tenant tables
   ```typescript
   // ✅ CORRECT
   const orders = await createTenantQuery(supabase, 'orders').select('*');
   
   // ❌ WRONG - May leak data across tenants!
   const orders = await supabase.from('orders').select('*');
   ```

2. **Validate tenant access** before showing data
   ```typescript
   const hasAccess = await validateTenantAccess(userId, tenantId);
   if (!hasAccess) throw new Error('Unauthorized');
   ```

3. **Use the tenant context provider** in client components

4. **Always resolve tenant** in server components and API routes

## ⚠️ Important Rules

1. **DO NOT** import internal files directly
   ```typescript
   // ❌ WRONG
   import { something } from '@/core/multi-tenancy/resolver';
   
   // ✅ CORRECT
   import { something } from '@/core/multi-tenancy';
   ```

2. **ALWAYS** validate tenant access before data operations

3. **NEVER** bypass tenant isolation for convenience

4. **ALWAYS** use RLS policies on tenant-aware tables

## 📝 Configuration

```env
# .env.local

# Enable multi-tenancy
NEXT_PUBLIC_MULTI_TENANT_ENABLED=true

# Tenant resolution strategy
NEXT_PUBLIC_TENANT_RESOLUTION=subdomain

# Base domain for subdomains
NEXT_PUBLIC_BASE_DOMAIN=yourapp.com

# Optional: Default tenant for development
NEXT_PUBLIC_DEFAULT_TENANT_ID=...
```

## 🧪 Testing

```bash
# Test multi-tenancy
npm run test src/core/multi-tenancy

# Test specific component
npm run test src/core/multi-tenancy/resolver.test.ts
```

## 📚 Additional Resources

- [Multi-Tenant Architecture Guide](../../docs/MULTI_ROLE_ARCHITECTURE.md)
- [Row-Level Security in PostgreSQL](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)




