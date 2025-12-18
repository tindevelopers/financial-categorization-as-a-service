# Turborepo Setup Guide

## Overview

This guide explains how to set up and use the Turborepo monorepo structure for complex multi-domain deployments.

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Git

## Quick Start

### Installation

```bash
npx create-tinadmin-multitenant@latest my-platform
cd my-platform
pnpm install
```

### Development

```bash
# Run all apps in development
pnpm dev

# Run specific app
pnpm --filter @tinadmin/admin dev
pnpm --filter @tinadmin/portal dev
```

### Building

```bash
# Build all apps and packages
pnpm build

# Build specific app
pnpm --filter @tinadmin/admin build
pnpm --filter @tinadmin/portal build
```

## Project Structure

```
my-platform/
├── apps/
│   ├── admin/                    # Admin dashboard (admin.domain.com)
│   │   ├── app/
│   │   ├── components/
│   │   ├── package.json
│   │   └── next.config.ts
│   └── portal/                   # Consumer portal (domain.com)
│       ├── app/
│       ├── components/
│       ├── package.json
│       └── next.config.ts
├── packages/
│   ├── @tinadmin/core/          # Core modules
│   ├── @tinadmin/ui-admin/      # Admin UI components
│   ├── @tinadmin/ui-consumer/   # Consumer UI components
│   └── @tinadmin/config/        # Shared configuration
├── turbo.json                   # Turborepo configuration
├── pnpm-workspace.yaml          # Workspace configuration
└── package.json                 # Root package.json
```

## Apps

### Admin App (`apps/admin`)

**Purpose:** Multi-tenant administration dashboard

**Port:** 3001 (development)

**Domain:** `admin.domain.com` (production)

**Features:**
- Tenant management
- User and role management
- Billing and subscriptions
- Analytics and reporting
- CRM functionality

### Portal App (`apps/portal`)

**Purpose:** Consumer-facing portal with SEO optimization

**Port:** 3002 (development)

**Domain:** `domain.com` (production)

**Features:**
- Public-facing pages
- SSG/ISR for SEO
- Consumer branding
- Public APIs

## Packages

### @tinadmin/core

Core SaaS modules: auth, billing, database, multi-tenancy, permissions, email.

**Usage:**
```typescript
import { signIn, getCurrentTenant } from '@tinadmin/core';
import { createCheckoutSession } from '@tinadmin/core/billing';
```

### @tinadmin/ui-admin

Admin-specific UI components: sidebar, header, admin tables, forms, charts.

**Usage:**
```typescript
import { AppSidebar, AppHeader } from '@tinadmin/ui-admin';
```

### @tinadmin/ui-consumer

Consumer-facing UI components: landing pages, public layouts, consumer forms.

**Usage:**
```typescript
import { ConsumerLayout } from '@tinadmin/ui-consumer';
```

### @tinadmin/config

Shared configuration and constants.

**Usage:**
```typescript
import { APP_CONFIG, FEATURES } from '@tinadmin/config';
```

## Turborepo Configuration

### turbo.json

Defines the build pipeline and task dependencies:

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### pnpm-workspace.yaml

Defines workspace packages:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

## Development Workflow

### Adding a New Feature

1. Create feature branch:
```bash
git checkout -b feature/my-feature
```

2. Make changes in appropriate app/package
3. Test locally:
```bash
pnpm dev
```

4. Build to verify:
```bash
pnpm build
```

5. Commit and push:
```bash
git commit -m "feat: add my feature"
git push origin feature/my-feature
```

### Working with Packages

#### Building a Package

```bash
pnpm --filter @tinadmin/core build
```

#### Watching a Package

```bash
pnpm --filter @tinadmin/core dev
```

#### Using Local Packages

Packages are automatically linked via workspace protocol (`workspace:*`).

## Deployment

### Admin App Deployment

Deploy `apps/admin` to your hosting platform:

**Vercel:**
1. Connect `apps/admin` directory as a project
2. Set domain to `admin.domain.com`
3. Configure environment variables

**Environment Variables:**
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
STRIPE_SECRET_KEY=...
NEXT_PUBLIC_ADMIN_DOMAIN=admin.domain.com
```

### Portal App Deployment

Deploy `apps/portal` to your hosting platform:

**Vercel:**
1. Connect `apps/portal` directory as a project
2. Set domain to `domain.com`
3. Configure environment variables

**Environment Variables:**
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_PORTAL_DOMAIN=domain.com
```

## Domain Configuration

### Development

- Admin: `http://localhost:3001`
- Portal: `http://localhost:3002`

### Production

- Admin: `https://admin.domain.com`
- Portal: `https://domain.com`

### DNS Setup

1. Create A/CNAME records:
   - `admin.domain.com` → Admin app deployment
   - `domain.com` → Portal app deployment

2. Configure SSL certificates (automatic with Vercel)

## Troubleshooting

### Issue: Packages not found

**Solution:** Ensure packages are built:
```bash
pnpm build
```

### Issue: Type errors in packages

**Solution:** Rebuild packages:
```bash
pnpm --filter @tinadmin/core build
```

### Issue: Changes not reflecting

**Solution:** Clear Turborepo cache:
```bash
pnpm turbo clean
pnpm build
```

## Best Practices

1. **Keep packages independent** - Minimize cross-package dependencies
2. **Use workspace protocol** - Always use `workspace:*` for local packages
3. **Build before commit** - Ensure all packages build successfully
4. **Test both apps** - Verify changes work in both admin and portal
5. **Document changes** - Update README files when adding features

