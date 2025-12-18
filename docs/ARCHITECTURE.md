# TinAdmin SaaS Architecture

## Overview

TinAdmin SaaS Base is a flexible, enterprise-ready SaaS platform that supports both simple single-repo deployments and complex multi-domain Turborepo architectures.

## Architecture Modes

### 1. Simple Mode (Single Repo)

**Use Case:** MVPs, small applications, quick deployments

**Structure:**
```
project/
├── src/
│   ├── app/
│   │   ├── (admin)/      # Admin routes
│   │   ├── (consumer)/   # Consumer routes
│   │   └── api/          # API routes
│   ├── components/
│   └── core/             # Core modules (from package)
├── public/
└── supabase/
```

**Installation:**
```bash
npx create-tinadmin-saas@latest my-app
```

### 2. Complex Mode (Turborepo Monorepo)

**Use Case:** Multi-domain deployments, large-scale applications

**Structure:**
```
platform/
├── apps/
│   ├── admin/            # admin.domain.com
│   └── portal/           # domain.com
├── packages/
│   ├── @tinadmin/core/
│   ├── @tinadmin/ui-admin/
│   ├── @tinadmin/ui-consumer/
│   └── @tinadmin/config/
├── turbo.json
└── pnpm-workspace.yaml
```

**Installation:**
```bash
npx create-tinadmin-multitenant@latest my-platform
```

## Core Architecture

### Domain-Driven Design

The codebase is organized into domains:

- **Auth Domain** (`@tinadmin/core/auth`)
  - Authentication, sessions, password management
  - Audit logging

- **Multi-Tenancy Domain** (`@tinadmin/core/multi-tenancy`)
  - Tenant isolation and management
  - Organization management (dual-mode support)
  - Subdomain routing
  - White-labeling

- **Billing Domain** (`@tinadmin/core/billing`)
  - Stripe integration
  - Subscriptions and payments
  - Usage metering

- **Permissions Domain** (`@tinadmin/core/permissions`)
  - Role-Based Access Control (RBAC)
  - Permission gates
  - Access control middleware

- **Database Domain** (`@tinadmin/core/database`)
  - Supabase clients (regular, admin, tenant-scoped)
  - Type definitions
  - Database utilities

- **Email Domain** (`@tinadmin/core/email`)
  - Email service abstraction
  - Multiple provider support (Resend, SES, Inbucket)

- **Shared Domain** (`@tinadmin/core/shared`)
  - Common utilities
  - CRUD helpers
  - Validation utilities
  - Query helpers

## Dual-Mode Support

### Multi-Tenant Mode

Standard tenant isolation where each tenant can have multiple organizations:

```
Tenant A (McDonald's Corp)
├── Organization 1 (Franchise #1)
├── Organization 2 (Franchise #2)
└── Organization 3 (Franchise #3)
```

### Organization-Only Mode

Single tenant managing multiple organizations:

```
Platform Tenant
├── Organization 1 (Tourist Attraction #1)
├── Organization 2 (Tourist Attraction #2)
└── Organization 3 (Tourist Attraction #3)
```

## Data Flow

### Request Flow

1. **Middleware** resolves tenant/organization context
2. **Context** is set in headers (`x-tenant-id`, `x-organization-id`)
3. **Server Components** use context for data fetching
4. **RLS Policies** enforce data isolation at database level

### Authentication Flow

1. User authenticates via Supabase Auth
2. User's `tenant_id` is retrieved from `users` table
3. Tenant context is established
4. Organization context is resolved (if applicable)
5. Permissions are checked based on role

## Database Architecture

### Row-Level Security (RLS)

All tenant-scoped tables have RLS policies that:
- Filter data by `tenant_id`
- Support dual-mode (multi-tenant vs organization-only)
- Allow platform admins to see all data

### Key Tables

- `tenants` - Top-level tenant isolation
- `workspaces` - Organizations within tenants
- `users` - User accounts with tenant association
- `roles` - Role definitions
- `user_tenant_roles` - User-tenant-role associations
- `workspace_users` - User-workspace associations

## Deployment Architecture

### Single Repo Deployment

- Single Next.js app
- Route-based separation (`/admin/*` vs `/*`)
- Shared database
- Single domain

### Multi-Domain Deployment

- Admin app: `admin.domain.com`
- Portal app: `domain.com`
- Separate deployments
- Shared database
- Domain-based routing

## Performance Optimizations

### Bundle Optimization

- Package import optimization (`optimizePackageImports`)
- Dynamic imports for heavy components (charts, calendars)
- Webpack aliases for better tree-shaking
- Code splitting by route

### Database Optimization

- Indexes on common query patterns
- Optimized RLS policies
- Query result caching where appropriate

## Security

### Data Isolation

- RLS policies enforce tenant isolation
- Application-level validation
- Middleware context resolution

### Authentication

- Supabase Auth integration
- Session management
- Password policies

### Authorization

- Role-Based Access Control (RBAC)
- Permission gates
- Tenant-scoped access control

## Scalability

### Horizontal Scaling

- Stateless application servers
- Shared database with RLS
- CDN for static assets

### Vertical Scaling

- Database query optimization
- Caching strategies
- Resource allocation per tenant tier

## Technology Stack

- **Framework:** Next.js 15 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Billing:** Stripe
- **Styling:** Tailwind CSS
- **Type Safety:** TypeScript
- **Monorepo:** Turborepo (for complex deployments)
- **Package Manager:** pnpm (for monorepo)

## Best Practices

1. **Always use tenant-aware queries** - Never bypass RLS
2. **Use shared utilities** - CRUD helpers, validation, query builders
3. **Separate admin and consumer UIs** - Different layouts and components
4. **Optimize bundles** - Use dynamic imports for heavy components
5. **Follow domain boundaries** - Import from domain index files only

