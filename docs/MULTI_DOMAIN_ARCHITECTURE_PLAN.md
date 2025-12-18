# Multi-Domain SaaS Architecture Plan

## Overview

Build a scalable multi-tenant SaaS platform with separate domains for admin (`admin.domain.com`) and public-facing application (`domain.com`), optimized for SEO with static page generation.

## Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
                    │           Shared Infrastructure          │
                    │  ┌─────────────┐  ┌─────────────────┐   │
                    │  │  Supabase   │  │   Auth Service  │   │
                    │  │  (eu-central-1) │  │               │   │
                    │  └──────┬──────┘  └────────┬────────┘   │
                    │         │                   │            │
                    │         └─────────┬─────────┘            │
                    │                   │                      │
                    │           ┌───────▼───────┐              │
                    │           │  Shared API   │              │
                    │           └───────┬───────┘              │
                    └───────────────────┼──────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
        ┌───────────▼───────────┐           ┌───────────────▼───────────┐
        │   admin.domain.com    │           │      domain.com           │
        │   ┌───────────────┐   │           │   ┌───────────────────┐   │
        │   │  Next.js App  │   │           │   │  Next.js SSG/ISR  │   │
        │   ├───────────────┤   │           │   ├───────────────────┤   │
        │   │ Multi-Tenant  │   │           │   │   Static Pages    │   │
        │   │   Dashboard   │   │           │   │   SEO Optimized   │   │
        │   └───────────────┘   │           │   └───────────────────┘   │
        └───────────────────────┘           └───────────────────────────┘
```

## Repository Strategy: Monorepo (Recommended)

### Why Monorepo over Separate Repos

| Factor | Monorepo | Separate Repos |
|--------|----------|----------------|
| Shared code | Easy (internal packages) | Harder (npm packages) |
| Type safety | Full across apps | Manual sync required |
| AI tools (Cursor/Claude) | Single context | Context switching |
| Deployment stability | Atomic deploys | Version drift risk |
| Database schema | Single source of truth | Sync issues possible |

### Recommended Directory Structure

```
city-portal/
├── apps/
│   ├── admin/                  # admin.domain.com (Next.js)
│   │   ├── app/
│   │   ├── components/
│   │   └── package.json
│   └── portal/                 # domain.com (Next.js with SSG)
│       ├── app/
│       ├── components/
│       └── package.json
├── packages/
│   ├── database/               # Supabase client, types, migrations
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── admin-client.ts
│   │   │   └── types.ts
│   │   └── package.json
│   ├── auth/                   # Shared auth logic
│   │   ├── src/
│   │   └── package.json
│   ├── ui/                     # Shared UI components
│   │   ├── src/
│   │   └── package.json
│   └── config/                 # Shared configuration
│       ├── src/
│       └── package.json
├── supabase/                   # Database migrations
│   ├── migrations/
│   └── config.toml
├── turbo.json                  # Turborepo config
├── package.json                # Root package.json
└── pnpm-workspace.yaml         # Workspace config
```

## Domain Architecture

### Admin Portal (admin.domain.com)

**Purpose:** Multi-tenant administration, user management, billing

**Features:**
- Multi-tenant dashboard
- User and role management
- Billing and subscription management
- Tenant settings and configuration
- Analytics and reporting

**Tech Stack:**
- Next.js App Router
- Server-side rendering for dynamic content
- Supabase Auth with RLS
- Stripe integration for billing

### Public Portal (domain.com)

**Purpose:** SEO-optimized public-facing city portal

**Features:**
- Static pages for cities (pre-rendered)
- Dynamic content via ISR
- Public APIs for integrations
- Search functionality
- Mobile-responsive design

**Tech Stack:**
- Next.js with Static Site Generation (SSG)
- Incremental Static Regeneration (ISR)
- CDN caching (Vercel/CloudFront)
- Structured data (JSON-LD)

## SEO Strategy for City Portal

### 1. Static Site Generation (SSG)

Pre-render all city pages at build time for maximum SEO performance:

```typescript
// apps/portal/app/cities/[slug]/page.tsx
export async function generateStaticParams() {
  const cities = await getCities();
  return cities.map((city) => ({ slug: city.slug }));
}

export default async function CityPage({ params }: { params: { slug: string } }) {
  const city = await getCity(params.slug);
  return <CityTemplate city={city} />;
}
```

### 2. Incremental Static Regeneration (ISR)

Update pages without full rebuild:

```typescript
export const revalidate = 3600; // Revalidate every hour
```

### 3. Dynamic Sitemap Generation

Auto-generate sitemap for all cities:

```typescript
// apps/portal/app/sitemap.ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cities = await getCities();
  return cities.map((city) => ({
    url: `https://domain.com/cities/${city.slug}`,
    lastModified: city.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));
}
```

### 4. Structured Data (JSON-LD)

Rich snippets for search engines:

```typescript
export default function CityPage({ city }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'City',
    name: city.name,
    description: city.description,
    // ... additional schema
  };
  
  return (
    <>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <CityTemplate city={city} />
    </>
  );
}
```

## AI Development Tools Setup

### Recommended Workflow for Stability

1. **Git-based workflow** - All changes through version control
2. **Feature branches** - Isolate AI-generated changes
3. **Type safety** - TypeScript catches AI mistakes
4. **Automated tests** - CI validates changes before merge
5. **Code review** - Human review of AI suggestions

### Tool Configuration

#### Cursor with Claude Code

- Use `.cursorrules` file for project-specific AI instructions
- Define coding standards and patterns
- Set up context for multi-repo awareness

#### DeepAgent / Abacus.ai

- API integration for automated tasks
- Code generation with validation pipeline
- Automated testing integration

### Recommended .cursorrules

```
# Project: Multi-Domain City Portal

## Architecture
- Monorepo with Turborepo
- apps/admin: Admin dashboard (admin.domain.com)
- apps/portal: Public portal (domain.com)
- packages/: Shared code

## Conventions
- TypeScript strict mode
- React Server Components preferred
- Supabase for database with RLS
- pnpm for package management

## SEO Requirements
- All public pages must be SSG or ISR
- Include meta tags and structured data
- Generate sitemap dynamically
```

## Multi-Tenant Database Design

### Tenant Isolation Strategy

Using Row Level Security (RLS) in Supabase:

```sql
-- Enable RLS on all tenant tables
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

-- Policy for tenant isolation
CREATE POLICY "Tenants can only access their own data"
ON cities
FOR ALL
USING (tenant_id = auth.jwt() ->> 'tenant_id');
```

### Schema Design

```sql
-- Core tables
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  content JSONB,
  seo_meta JSONB,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Deployment Strategy

### Recommended: Vercel

- Native Next.js support
- Automatic preview deployments
- Edge caching for SSG pages
- Easy domain configuration

### Domain Configuration

```
admin.domain.com → apps/admin (Vercel project 1)
domain.com       → apps/portal (Vercel project 2)
```

### Alternative: AWS with CloudFront

For more control:
- Lambda@Edge for SSR
- S3 + CloudFront for static assets
- Route53 for DNS
- ACM for SSL certificates

## Implementation Phases

### Phase 1: Monorepo Setup (Week 1)

1. Initialize Turborepo monorepo
2. Extract shared packages from current codebase
3. Set up build and test pipelines
4. Configure pnpm workspaces

### Phase 2: Admin App (Week 2-3)

1. Migrate current tinadmin-saas-base to apps/admin
2. Configure multi-tenant authentication
3. Set up domain routing for admin.domain.com
4. Implement tenant management features

### Phase 3: Public Portal (Week 3-4)

1. Create SSG-optimized portal app
2. Implement city pages with SSG/ISR
3. Configure SEO (sitemap, meta, structured data)
4. Set up domain routing for domain.com

### Phase 4: Integration & Testing (Week 5)

1. End-to-end testing across both apps
2. Performance optimization
3. Security audit
4. Documentation

### Phase 5: Production Deployment (Week 6)

1. Production environment setup
2. DNS configuration
3. SSL certificates
4. Monitoring and alerting

## Key Decisions to Make

1. **Deployment Platform**: Vercel vs AWS vs GCP
2. **City Data Source**: CMS, database, or static files
3. **Tenant Model**: Shared database with RLS or isolated databases
4. **CDN Strategy**: Vercel Edge vs CloudFront vs Cloudflare

## Next Steps

1. ✅ Confirm architecture approach
2. ⏳ Create monorepo structure with Turborepo
3. ⏳ Extract shared packages from current codebase
4. ⏳ Set up admin app (from current tinadmin-saas-base)
5. ⏳ Create public portal app with SSG
6. ⏳ Configure domain routing
7. ⏳ Set up CI/CD pipeline

---

**Document Created:** December 18, 2025
**Last Updated:** December 18, 2025
**Status:** Planning Phase

