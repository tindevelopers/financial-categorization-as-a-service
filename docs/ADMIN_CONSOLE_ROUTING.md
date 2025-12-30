# Admin Console Routing (Portal vs Full Admin)

This repo contains two separate Next.js applications:

- **Consumer Portal**: `apps/portal`
  - Tenant experience + marketing site
  - Also contains **Enterprise Admin** pages for enterprise tenant admins (scoped to their tenant)
- **Full Admin Console**: `apps/admin`
  - System-wide management console for **Platform Admin / System Admin / Super Admin**

## Desired routing behavior

- Global admins (role in `Platform Admin`, `System Admin`, `Super Admin`, with `tenant_id = NULL`) must use the **Full Admin Console**.
- Tenant users use the **Consumer Portal**.
- Enterprise tenant admins (e.g. `Organization Admin` / `Enterprise Admin` on an enterprise tenant) can access **Enterprise Admin** pages within the portal.

## Domains / deployments (recommended)

Use two Vercel projects + two domains:

- `fincat.develop.tinconnect.com` → `apps/portal`
- `admin.fincat.develop.tinconnect.com` → `apps/admin`

## Environment variables

### Portal (`apps/portal`)

- `NEXT_PUBLIC_ADMIN_DOMAIN=admin.fincat.develop.tinconnect.com`
- `NEXT_PUBLIC_SUPABASE_URL=...`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`

### Admin (`apps/admin`)

- `NEXT_PUBLIC_PORTAL_DOMAIN=fincat.develop.tinconnect.com`
- `NEXT_PUBLIC_SUPABASE_URL=...`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`

## Code pointers

- **Global admin role helper**: `packages/@tinadmin/core/src/shared/admin-roles.ts`
- **Portal redirect of global admins → admin domain**: `apps/portal/middleware.ts`
- **Admin enforcement (only global admins allowed)**: `apps/admin/middleware.ts`
- **Enterprise Admin page (tenant-scoped)**: `apps/portal/app/dashboard/enterprise-admin/enterprise-oauth/page.tsx`
- **Enterprise Admin API (tenant-scoped)**: `apps/portal/app/api/enterprise-admin/enterprise-oauth/route.ts`


