# Migration Guide

## Overview

This guide helps you migrate from the current codebase structure to the optimized Turborepo structure or update to the latest version.

## Migration Paths

### Path 1: Current Structure → Turborepo Monorepo

If you want to migrate your existing single-repo application to Turborepo:

#### Step 1: Create Turborepo Structure

```bash
npx create-tinadmin-multitenant@latest my-platform
cd my-platform
```

#### Step 2: Copy Your Code

```bash
# Copy admin routes
cp -r your-app/src/app/admin my-platform/apps/admin/app/
cp -r your-app/src/app/saas my-platform/apps/admin/app/

# Copy consumer routes
cp -r your-app/src/app/your-consumer-routes my-platform/apps/portal/app/

# Copy components
cp -r your-app/src/components my-platform/apps/admin/components/
```

#### Step 3: Update Imports

Replace imports:
- `@/core/*` → `@tinadmin/core/*`
- Update component imports to use packages

#### Step 4: Update Configuration

- Copy environment variables
- Update `next.config.ts` files
- Update `tsconfig.json` files

#### Step 5: Test and Deploy

```bash
pnpm install
pnpm build
pnpm dev
```

### Path 2: Single-Tenant → Multi-Tenant

If you're upgrading from single-tenant to multi-tenant:

#### Step 1: Run Migration

```bash
# Apply multi-tenancy migration
supabase migration up
```

#### Step 2: Create Tenant

```typescript
import { createTenant } from '@tinadmin/core/database';

const tenant = await createTenant({
  name: 'My Tenant',
  domain: 'mytenant',
  status: 'active',
  plan: 'pro',
  region: 'us-east-1',
});
```

#### Step 3: Update User Associations

```sql
-- Associate existing users with tenant
UPDATE users SET tenant_id = 'your-tenant-id' WHERE tenant_id IS NULL;
```

#### Step 4: Update Code

- Add tenant context providers
- Update queries to be tenant-aware
- Add tenant resolution in middleware

### Path 3: Multi-Tenant → Organization-Only Mode

If you want to switch a tenant to organization-only mode:

#### Step 1: Update Tenant Mode

```sql
UPDATE tenants 
SET mode = 'organization-only' 
WHERE id = 'your-tenant-id';
```

#### Step 2: Create Platform Tenant (if needed)

```sql
INSERT INTO tenants (name, domain, mode, status, plan, region)
VALUES (
  'Platform Tenant',
  'platform',
  'organization-only',
  'active',
  'enterprise',
  'global'
);
```

#### Step 3: Migrate Organizations

```sql
-- Move organizations to platform tenant
UPDATE workspaces 
SET tenant_id = 'platform-tenant-id' 
WHERE tenant_id = 'old-tenant-id';
```

#### Step 4: Update Application Code

- Update context resolution to use organization-only mode
- Update queries to filter by organization_id
- Update UI to show organization switcher

### Path 4: Updating to Latest Version

#### Step 1: Update Dependencies

```bash
# Simple package
npm update @tindeveloper/tinadmin-saas-base

# Monorepo
pnpm update @tinadmin/core @tinadmin/ui-admin @tinadmin/ui-consumer

# Core package
npm update @tindeveloper/tinadmin-core
```

#### Step 2: Run Migrations

```bash
supabase migration up
```

#### Step 3: Update Code

- Review breaking changes in changelog
- Update deprecated APIs
- Test thoroughly

## Common Migration Scenarios

### Scenario 1: Adding Dual-Mode Support

1. Run migration:
```bash
supabase migration up 20251219000000_add_dual_mode_support.sql
```

2. Update tenant mode:
```sql
UPDATE tenants SET mode = 'organization-only' WHERE id = 'tenant-id';
```

3. Update code to use `resolveContext()`:
```typescript
import { resolveContext } from '@tinadmin/core/multi-tenancy';

const context = await resolveContext({ headers, url, hostname });
```

### Scenario 2: Migrating Routes

1. Move routes:
```bash
mv src/app/saas src/app/(admin)/saas
mv src/app/page.tsx src/app/(consumer)/page.tsx
```

2. Update layouts:
- Create `src/app/(admin)/layout.tsx`
- Create `src/app/(consumer)/layout.tsx`

3. Update imports in moved files

### Scenario 3: Extracting to Packages

1. Create package structure:
```bash
mkdir -p packages/@tinadmin/core/src
```

2. Move core modules:
```bash
cp -r src/core/* packages/@tinadmin/core/src/
```

3. Update package.json:
```json
{
  "name": "@tinadmin/core",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

4. Update imports:
- `@/core/*` → `@tinadmin/core/*`

## Rollback Procedures

### Rollback Migration

```bash
# Rollback specific migration
supabase migration down

# Rollback to specific version
supabase migration repair --version 20251218000000
```

### Rollback Code Changes

```bash
# Revert to previous commit
git revert HEAD

# Or reset to specific commit
git reset --hard <commit-hash>
```

## Testing After Migration

### Checklist

- [ ] All routes work correctly
- [ ] Authentication works
- [ ] Tenant resolution works
- [ ] Data isolation verified
- [ ] Billing integration works
- [ ] Permissions work correctly
- [ ] Build succeeds
- [ ] Tests pass

### Test Commands

```bash
# Type check
pnpm type-check

# Lint
pnpm lint

# Build
pnpm build

# Test
pnpm test
```

## Troubleshooting

### Issue: Import errors after migration

**Solution:** Ensure packages are built:
```bash
pnpm --filter @tinadmin/core build
```

### Issue: Type errors

**Solution:** Regenerate types:
```bash
supabase gen types typescript --local > src/core/database/types.ts
```

### Issue: RLS policies blocking access

**Solution:** Check policy conditions:
```sql
SELECT * FROM pg_policies WHERE tablename = 'your_table';
```

## Getting Help

If you encounter issues during migration:

1. Check documentation: `/docs`
2. Review migration scripts: `/supabase/migrations`
3. Open GitHub issue: https://github.com/tindevelopers/tinadmin-saas-base/issues
4. Check existing issues for similar problems

