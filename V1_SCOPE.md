# Version 1 Scope Document

**Decision Date**: December 18, 2025  
**Version**: 1.0.0  
**Status**: CONFIRMED

---

## Executive Summary

Version 1 of TinAdmin SaaS Base is scoped as an **Admin-only release** (Option A). The portal app and consumer-facing features are explicitly deferred to Version 2.

---

## V1 Scope: Admin Dashboard Only

### In Scope

| Feature | Description | Status |
|---------|-------------|--------|
| **Admin Dashboard** | Full-featured admin dashboard application | ✅ Complete |
| **Multi-tenancy** | Tenant isolation via Row-Level Security (RLS) | ✅ Complete |
| **Stripe Billing** | Subscription management, payment processing | ✅ Complete |
| **User Management** | Create, update, delete users within tenant | ✅ Complete |
| **Role-Based Access Control** | Permissions system with role hierarchy | ✅ Complete |
| **CRM Foundations** | Contacts, companies, deals, activities | ✅ Complete |
| **Authentication** | Signup, signin, signout, password reset | ✅ Complete |
| **Database Schema** | Full migration set with RLS policies | ✅ Complete |

### Out of Scope (Deferred to V2)

| Feature | Description | Reason |
|---------|-------------|--------|
| **Portal App** | Consumer-facing portal (`apps/portal`) | Not needed for admin-focused V1 |
| **Self-Service Account Management** | End-user account portal | Requires portal app |
| **Public Marketing Pages** | Landing pages, pricing pages | Requires portal app |
| **Tenant Switcher UI** | UI component to switch between tenants | V1 uses single-tenant admin experience |
| **Subdomain Routing** | Tenant-specific subdomains | V2 enhancement |
| **Workspace Switching** | Hierarchical workspace navigation | V2 enhancement |
| **Tenant Breadcrumbs** | Navigation breadcrumbs for tenant context | V2 enhancement |

---

## Technical Architecture (V1)

```
┌─────────────────────────────────────────────────────────────┐
│                    TinAdmin V1 Architecture                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   apps/admin                         │    │
│  │  • Next.js 15 App Router                            │    │
│  │  • Admin Dashboard UI                               │    │
│  │  • Authentication Pages                             │    │
│  │  • CRM Features                                     │    │
│  │  • Billing Management                               │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              packages/@tinadmin/core                 │    │
│  │  • Multi-tenancy Context                            │    │
│  │  • Authentication Helpers                           │    │
│  │  • Permission System                                │    │
│  │  • Database Client                                  │    │
│  │  • Billing Actions                                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                     Supabase                         │    │
│  │  • PostgreSQL Database                              │    │
│  │  • Row-Level Security                               │    │
│  │  • Authentication                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                      Stripe                          │    │
│  │  • Subscription Management                          │    │
│  │  • Payment Processing                               │    │
│  │  • Webhook Integration                              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘

NOT IN V1:
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐    │
│  │              apps/portal (DEFERRED)                  │    │
│  │  • Consumer-facing portal                           │    │
│  │  • Self-service features                            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Multi-Tenancy in V1

V1 implements multi-tenancy at the **database level** via Row-Level Security (RLS):

- **Tenant Isolation**: All data is isolated by `tenant_id` column
- **RLS Policies**: Automatic enforcement at database layer
- **Single Admin Experience**: One admin dashboard per deployment
- **No Tenant Switching**: Users belong to one tenant in V1

### V1 Multi-Tenant Behavior

```
User logs in → Associated with tenant → All queries filtered by tenant_id
```

### V2 Multi-Tenant Enhancements (Planned)

- Tenant switcher for users with multi-tenant access
- Subdomain-based tenant routing
- Workspace hierarchy within tenants

---

## Portal App Status

The `apps/portal` directory contains placeholder files only:

```
apps/portal/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
└── package.json
```

**V1 Action**: Portal remains as placeholder. No development effort allocated.

**V2 Plan**: Implement consumer-facing portal with:
- Public marketing pages
- Self-service account management
- Tenant-specific branding

---

## V1 Release Checklist

Before V1 release, complete:

- [ ] Create `.env.example` with all required variables
- [ ] Add unit tests for core modules
- [ ] Security audit of RLS policies
- [ ] Complete Stripe production checklist
- [ ] Add global error handling
- [ ] Create deployment documentation

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-18 | Initial V1 scope definition |

---

## Approval

This scope document defines the boundaries of Version 1. Any features not listed in "In Scope" are explicitly out of scope and will be considered for Version 2.

