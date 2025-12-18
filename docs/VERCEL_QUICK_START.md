# Vercel Deployment - Quick Start Guide

## Quick Deployment Steps

### 1. Install Prerequisites

```bash
npm install -g vercel pnpm
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Deploy Admin App

```bash
cd apps/admin
vercel
# Follow prompts to create new project
# Project name: tinadmin-admin
# Root directory: apps/admin
# Build command: cd ../.. && pnpm install && pnpm turbo run build --filter=@tinadmin/admin
# Output directory: .next
```

### 4. Deploy Portal App

```bash
cd apps/portal
vercel
# Follow prompts to create new project
# Project name: tinadmin-portal
# Root directory: apps/portal
# Build command: cd ../.. && pnpm install && pnpm turbo run build --filter=@tinadmin/portal
# Output directory: .next
```

### 5. Set Environment Variables

For each project in Vercel Dashboard → Settings → Environment Variables:

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Optional:**
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_MULTI_TENANT_ENABLED=true`
- `NEXT_PUBLIC_SYSTEM_MODE=multi-tenant`

### 6. Configure Custom Domains

**Admin App:**
- Add domain: `admin.your-domain.com`
- Configure DNS: CNAME `admin` → Vercel DNS

**Portal App:**
- Add domain: `your-domain.com`
- Configure DNS: A record or CNAME → Vercel DNS

## Using the Deployment Script

```bash
./scripts/deploy-vercel.sh
```

Follow the prompts to deploy admin, portal, or both.

## Manual Deployment Commands

```bash
# Deploy admin
cd apps/admin && vercel --prod

# Deploy portal
cd apps/portal && vercel --prod
```

## Troubleshooting

### Build Fails: "Cannot find module"

**Fix:** Ensure build command includes `pnpm install`:
```bash
cd ../.. && pnpm install && pnpm turbo run build --filter=@tinadmin/admin
```

### Build Fails: "Package not found"

**Fix:** Build shared packages first:
```bash
pnpm turbo run build --filter=@tinadmin/core --filter=@tinadmin/ui-admin
```

### Environment Variables Not Working

**Fix:** 
1. Check variable names (case-sensitive)
2. Redeploy after adding variables
3. Ensure variables are in correct project

## Next Steps

1. ✅ Deployments complete
2. ⏭️ Configure custom domains
3. ⏭️ Set up monitoring
4. ⏭️ Configure CI/CD

See `docs/VERCEL_DEPLOYMENT.md` for detailed instructions.
