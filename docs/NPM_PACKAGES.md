# NPM Packages Guide

## Available Packages

TinAdmin SaaS Base provides multiple NPM packages for different use cases:

1. **@tindeveloper/tinadmin-saas-base** - Simple single-repo package
2. **@tindeveloper/tinadmin-multitenant** - Turborepo monorepo starter
3. **@tindeveloper/tinadmin-core** - Core modules (standalone)

## Package 1: @tindeveloper/tinadmin-saas-base

### Description

Single-repo Next.js application with admin and consumer routes. Perfect for simple deployments and MVPs.

### Installation

```bash
npx create-tinadmin-saas@latest my-app
cd my-app
npm install
```

### Features

- ✅ Admin routes at `/admin/*`
- ✅ Consumer routes at `/*`
- ✅ Multi-tenancy support
- ✅ Stripe billing integration
- ✅ Role-based access control
- ✅ All core modules included

### Project Structure

```
my-app/
├── src/
│   ├── app/
│   │   ├── (admin)/      # Admin routes
│   │   ├── (consumer)/   # Consumer routes
│   │   └── api/          # API routes
│   └── components/
├── public/
└── supabase/
```

### Usage

```typescript
// Import core modules
import { signIn, getCurrentTenant } from '@tindeveloper/tinadmin-saas-base/core';

// Use in your components
export default async function MyPage() {
  const tenant = await getCurrentTenant();
  // ...
}
```

## Package 2: @tindeveloper/tinadmin-multitenant

### Description

Turborepo monorepo starter with admin and portal apps. Perfect for complex multi-domain deployments.

### Installation

```bash
npx create-tinadmin-multitenant@latest my-platform
cd my-platform
pnpm install
```

### Features

- ✅ Turborepo monorepo structure
- ✅ Admin app (`admin.domain.com`)
- ✅ Portal app (`domain.com`)
- ✅ Shared packages
- ✅ Optimized build pipeline

### Project Structure

```
my-platform/
├── apps/
│   ├── admin/            # Admin dashboard
│   └── portal/           # Consumer portal
├── packages/
│   ├── @tinadmin/core/
│   ├── @tinadmin/ui-admin/
│   ├── @tinadmin/ui-consumer/
│   └── @tinadmin/config/
└── turbo.json
```

### Usage

```typescript
// In apps/admin or apps/portal
import { signIn } from '@tinadmin/core';
import { AppSidebar } from '@tinadmin/ui-admin';
```

## Package 3: @tindeveloper/tinadmin-core

### Description

Standalone core modules package. Use when you want to use core functionality in your own project.

### Installation

```bash
npm install @tindeveloper/tinadmin-core
```

### Features

- ✅ Auth module
- ✅ Multi-tenancy module
- ✅ Billing module
- ✅ Permissions module
- ✅ Database utilities
- ✅ Email service
- ✅ Shared utilities

### Usage

```typescript
// Import from main entry
import { signIn, getCurrentTenant, createCheckoutSession } from '@tindeveloper/tinadmin-core';

// Or import from specific domain
import { signIn } from '@tindeveloper/tinadmin-core/auth';
import { getCurrentTenant } from '@tindeveloper/tinadmin-core/multi-tenancy';
import { createCheckoutSession } from '@tindeveloper/tinadmin-core/billing';
```

## Choosing the Right Package

### Use @tindeveloper/tinadmin-saas-base when:

- Building a simple SaaS application
- Single domain deployment
- Quick MVP or prototype
- Don't need separate admin/consumer domains

### Use @tindeveloper/tinadmin-multitenant when:

- Building a complex platform
- Need separate admin and consumer domains
- Multiple apps sharing code
- Enterprise-scale deployment

### Use @tindeveloper/tinadmin-core when:

- Building custom application
- Need only core functionality
- Integrating into existing project
- Want to use specific modules only

## Package Versions

All packages follow semantic versioning:

- **Major version** (1.x.x): Breaking changes
- **Minor version** (x.1.x): New features, backward compatible
- **Patch version** (x.x.1): Bug fixes, backward compatible

## Updating Packages

### Simple Package

```bash
cd my-app
npm update @tindeveloper/tinadmin-saas-base
```

### Monorepo

```bash
cd my-platform
pnpm update @tinadmin/core @tinadmin/ui-admin @tinadmin/ui-consumer
```

### Core Package

```bash
npm update @tindeveloper/tinadmin-core
```

## Publishing Packages

Packages are published to NPM automatically via CI/CD:

1. Version bump in `package.json`
2. Git tag created
3. CI/CD publishes to NPM
4. Release notes generated

## Support

For issues or questions:
- GitHub Issues: https://github.com/tindevelopers/tinadmin-saas-base/issues
- Documentation: https://github.com/tindevelopers/tinadmin-saas-base/docs

