# Vercel Turborepo Deployment Guide

This guide walks you through deploying the TinAdmin SaaS Turborepo to Vercel with separate deployments for admin and portal apps.

## Prerequisites

1. Vercel account (sign up at https://vercel.com)
2. GitHub repository with your code
3. Supabase project linked and configured
4. pnpm installed locally

## Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

## Step 2: Login to Vercel

```bash
vercel login
```

## Step 3: Link Your Repository

### Option A: Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. You'll create two separate projects (one for admin, one for portal)

### Option B: Via CLI

```bash
cd /Users/foo/projects/tinadmin-saas-base
vercel link
```

## Step 4: Deploy Admin App

### 4.1 Create Admin Project in Vercel

1. Go to Vercel Dashboard → Add New Project
2. Select your repository
3. Configure:
   - **Project Name**: `tinadmin-admin` (or your preferred name)
   - **Root Directory**: `apps/admin`
   - **Framework Preset**: Next.js
   - **Build Command**: `cd ../.. && pnpm turbo run build --filter=@tinadmin/admin`
   - **Output Directory**: `.next`
   - **Install Command**: `pnpm install`

### 4.2 Configure Environment Variables

Add these environment variables in Vercel Dashboard:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xcdlcbphynscowkawabt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Stripe (if using)
STRIPE_SECRET_KEY=your-stripe-secret-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key

# Multi-Tenancy
NEXT_PUBLIC_MULTI_TENANT_ENABLED=true
NEXT_PUBLIC_TENANT_RESOLUTION=subdomain
NEXT_PUBLIC_BASE_DOMAIN=your-domain.com

# System Mode
NEXT_PUBLIC_SYSTEM_MODE=multi-tenant

# Admin Domain
NEXT_PUBLIC_ADMIN_DOMAIN=admin.your-domain.com
```

### 4.3 Deploy Admin App

Click "Deploy" in Vercel Dashboard, or use CLI:

```bash
cd apps/admin
vercel --prod
```

## Step 5: Deploy Portal App

### 5.1 Create Portal Project in Vercel

1. Go to Vercel Dashboard → Add New Project
2. Select the same repository
3. Configure:
   - **Project Name**: `tinadmin-portal` (or your preferred name)
   - **Root Directory**: `apps/portal`
   - **Framework Preset**: Next.js
   - **Build Command**: `cd ../.. && pnpm turbo run build --filter=@tinadmin/portal`
   - **Output Directory**: `.next`
   - **Install Command**: `pnpm install`

### 5.2 Configure Environment Variables

Add the same environment variables as admin app, but with:

```env
# Portal Domain
NEXT_PUBLIC_PORTAL_DOMAIN=your-domain.com
```

### 5.3 Deploy Portal App

Click "Deploy" in Vercel Dashboard, or use CLI:

```bash
cd apps/portal
vercel --prod
```

## Step 6: Configure Custom Domains

### 6.1 Admin Domain (admin.your-domain.com)

1. In Vercel Dashboard → Admin Project → Settings → Domains
2. Add domain: `admin.your-domain.com`
3. Follow DNS configuration instructions
4. Add CNAME record: `admin` → `cname.vercel-dns.com`

### 6.2 Portal Domain (your-domain.com)

1. In Vercel Dashboard → Portal Project → Settings → Domains
2. Add domain: `your-domain.com`
3. Follow DNS configuration instructions
4. Add A record or CNAME as instructed

## Step 7: Configure Turborepo Remote Caching (Optional)

For faster builds, set up Turborepo remote caching:

1. Get your Turborepo token:
   ```bash
   pnpm turbo login
   ```

2. Add to Vercel environment variables:
   - `TURBO_TEAM`: Your Turborepo team name
   - `TURBO_TOKEN`: Your Turborepo token

## Step 8: Verify Deployment

### 8.1 Check Admin App

Visit: `https://admin.your-domain.com`

### 8.2 Check Portal App

Visit: `https://your-domain.com`

### 8.3 Verify Features

- [ ] Admin dashboard loads correctly
- [ ] Portal loads correctly
- [ ] Authentication works
- [ ] Multi-tenancy works
- [ ] Database connections work

## Troubleshooting

### Issue: Build Fails with "Package not found"

**Solution**: Ensure `pnpm install` runs at root level. Update build command:
```bash
cd ../.. && pnpm install && pnpm turbo run build --filter=@tinadmin/admin
```

### Issue: Environment Variables Not Working

**Solution**: 
1. Check variable names match exactly (case-sensitive)
2. Ensure variables are added to correct project
3. Redeploy after adding variables

### Issue: Domain Not Resolving

**Solution**:
1. Wait for DNS propagation (can take up to 48 hours)
2. Verify DNS records are correct
3. Check domain configuration in Vercel

### Issue: Turbo Build Cache Issues

**Solution**: Clear cache and rebuild:
```bash
pnpm turbo clean
# Then redeploy
```

## CI/CD Setup

### GitHub Actions Integration

Vercel automatically deploys on push to main branch. To customize:

1. Go to Vercel Dashboard → Project → Settings → Git
2. Configure branch deployments
3. Set up preview deployments for PRs

### Manual Deployment

```bash
# Deploy admin
cd apps/admin
vercel --prod

# Deploy portal
cd apps/portal
vercel --prod
```

## Environment-Specific Configuration

### Production

- Use production Supabase project
- Use production Stripe keys
- Set `NODE_ENV=production`

### Preview/Staging

- Use staging Supabase project
- Use test Stripe keys
- Set `NODE_ENV=development`

## Monitoring

1. **Vercel Analytics**: Enable in project settings
2. **Error Tracking**: Set up Sentry or similar
3. **Performance**: Monitor via Vercel dashboard

## Next Steps

After successful deployment:

1. Set up monitoring and alerts
2. Configure backup strategies
3. Set up CI/CD pipelines
4. Document deployment process for team
5. Set up staging environment

## Support

- Vercel Docs: https://vercel.com/docs
- Turborepo Docs: https://turbo.build/repo/docs
- Supabase Docs: https://supabase.com/docs
