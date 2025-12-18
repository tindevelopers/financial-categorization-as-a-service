# Dual-Mode Guide: Multi-Tenant vs Organization-Only

## Overview

TinAdmin SaaS Base supports two operational modes:

1. **Multi-Tenant Mode**: Standard SaaS with tenant isolation (tenant → organizations)
2. **Organization-Only Mode**: Single tenant managing multiple organizations

## When to Use Each Mode

### Multi-Tenant Mode

Use when:
- Building a SaaS platform serving multiple customers
- Each customer is a separate tenant
- Need complete tenant isolation
- Example: McDonald's Corp (tenant) → 10 franchises (organizations)

### Organization-Only Mode

Use when:
- Single organization managing multiple sub-organizations
- Don't need tenant-level isolation
- Simpler deployment model
- Example: Tourist Bureau (tenant) → multiple attractions (organizations)

## Configuration

### Environment Variables

```env
# Set system mode
NEXT_PUBLIC_SYSTEM_MODE=multi-tenant  # or 'organization-only'
```

### Database Configuration

The mode can also be set per tenant in the database:

```sql
-- Set tenant to organization-only mode
UPDATE tenants SET mode = 'organization-only' WHERE id = 'tenant-id';

-- Set tenant to multi-tenant mode (default)
UPDATE tenants SET mode = 'multi-tenant' WHERE id = 'tenant-id';
```

## Implementation

### Context Resolution

The system automatically resolves context based on mode:

```typescript
import { resolveContext } from '@tinadmin/core/multi-tenancy';

const context = await resolveContext({
  headers: request.headers,
  url: request.url,
  hostname: request.hostname,
});

// context.mode: 'multi-tenant' | 'organization-only'
// context.tenantId: string | null
// context.organizationId: string | null
// context.effectiveScope: 'tenant' | 'organization'
```

### Using Context in Components

#### Client Components

```typescript
import { useOrganization } from '@tinadmin/core/multi-tenancy';

function MyComponent() {
  const { tenantId, organizationId, mode } = useOrganization();
  
  // Use context for data fetching
  // ...
}
```

#### Server Components

```typescript
import { getCurrentTenant } from '@tinadmin/core/multi-tenancy/server';
import { resolveContext } from '@tinadmin/core/multi-tenancy/resolver';

export default async function MyPage() {
  const context = await resolveContext({ headers, url, hostname });
  
  // Use context for queries
  // ...
}
```

### Query Building

Queries automatically adapt to the mode:

```typescript
import { crudGetAll } from '@tinadmin/core/shared';

// Multi-tenant mode: Filters by tenant_id
// Organization-only mode: Filters by organization_id
const companies = await crudGetAll(supabase, 'companies', {
  tenantId: context.tenantId,
  organizationId: context.organizationId,
});
```

## Database Schema

### Tenants Table

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  mode TEXT DEFAULT 'multi-tenant' CHECK (mode IN ('multi-tenant', 'organization-only')),
  -- ... other fields
);
```

### Workspaces Table (Organizations)

```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  organization_type TEXT DEFAULT 'standard' 
    CHECK (organization_type IN ('standard', 'franchise', 'location', 'attraction', 'department')),
  -- ... other fields
  UNIQUE(tenant_id, slug)
);
```

## RLS Policies

RLS policies automatically adapt based on mode:

```sql
-- Policy checks mode and filters accordingly
CREATE POLICY "Workspaces: Dual-mode support"
  ON workspaces FOR SELECT
  USING (
    CASE 
      WHEN get_current_tenant_mode() = 'multi-tenant' 
      THEN tenant_id = get_current_tenant_id()
      ELSE organization_id IN (
        SELECT id FROM workspaces 
        WHERE id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid())
      )
    END
  );
```

## Migration Between Modes

### From Multi-Tenant to Organization-Only

1. Update tenant mode:
```sql
UPDATE tenants SET mode = 'organization-only' WHERE id = 'tenant-id';
```

2. Create platform tenant (if needed):
```sql
INSERT INTO tenants (name, domain, mode, status, plan, region)
VALUES ('Platform Tenant', 'platform', 'organization-only', 'active', 'enterprise', 'global');
```

3. Migrate organizations to platform tenant:
```sql
UPDATE workspaces SET tenant_id = 'platform-tenant-id' WHERE tenant_id = 'old-tenant-id';
```

### From Organization-Only to Multi-Tenant

1. Create new tenants for each organization
2. Update tenant mode:
```sql
UPDATE tenants SET mode = 'multi-tenant' WHERE id = 'tenant-id';
```

3. Migrate organizations to their respective tenants

## Best Practices

1. **Choose mode at tenant creation** - Set mode when creating tenant
2. **Use context resolver** - Always use `resolveContext()` for mode-aware operations
3. **Test both modes** - Ensure your code works in both modes
4. **Document mode choice** - Document why you chose a specific mode
5. **Plan migrations** - If switching modes, plan the migration carefully

## Examples

### Example 1: Multi-Tenant SaaS

```typescript
// Tenant: McDonald's Corp
// Organizations: Franchise #1, Franchise #2, etc.

const context = await resolveContext({ headers, url, hostname });
// context.mode = 'multi-tenant'
// context.tenantId = 'mcdonalds-corp-id'
// context.organizationId = 'franchise-1-id'
```

### Example 2: Organization-Only Platform

```typescript
// Tenant: Platform Tenant
// Organizations: Attraction #1, Attraction #2, etc.

const context = await resolveContext({ headers, url, hostname });
// context.mode = 'organization-only'
// context.tenantId = 'platform-tenant-id'
// context.organizationId = 'attraction-1-id'
```

## Troubleshooting

### Issue: Context not resolving correctly

**Solution:** Ensure middleware is setting headers correctly:
```typescript
// Middleware should set:
request.headers.set("x-tenant-id", context.tenantId);
request.headers.set("x-organization-id", context.organizationId);
request.headers.set("x-system-mode", context.mode);
```

### Issue: RLS policies blocking access

**Solution:** Check that RLS policies support dual-mode:
```sql
-- Ensure policies check get_current_tenant_mode()
SELECT * FROM pg_policies WHERE tablename = 'workspaces';
```

### Issue: Wrong mode detected

**Solution:** Check environment variable and tenant settings:
```typescript
const mode = await getSystemMode(tenantId);
console.log('Current mode:', mode);
```

