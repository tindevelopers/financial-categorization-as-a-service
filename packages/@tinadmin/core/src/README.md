# 🚀 SaaS Core - Domain-Driven Architecture

This is the central module for the entire SaaS platform, organized by domain.

## 📚 Table of Contents

- [Overview](#overview)
- [Domain Structure](#domain-structure)
- [Quick Start](#quick-start)
- [Usage Guidelines](#usage-guidelines)
- [Architecture Principles](#architecture-principles)
- [Migration Guide](#migration-guide)

---

## 🎯 Overview

The **SaaS Core** is organized into **6 key domains**, each responsible for a specific aspect of the platform:

```
src/core/
├── auth/              🔐 Authentication & Sessions
├── multi-tenancy/     🏢 Tenant Management & Isolation
├── billing/           💳 Payments & Subscriptions
├── permissions/       🔒 Role-Based Access Control
├── database/          🗄️ Data Access Layer
├── shared/            🔧 Common Utilities
└── index.ts           📋 Main Entry Point
```

Each domain is **self-contained** with:
- ✅ Clear public API (`index.ts`)
- ✅ Internal implementation files
- ✅ Documentation (`README.md`)
- ✅ TypeScript types
- ✅ Tests (future)

---

## 🏗️ Domain Structure

### 1. 🔐 [AUTH](/src/core/auth/README.md)

**Responsibilities:**
- User authentication (sign in, sign up, sign out)
- Session management
- Password management (reset, update)
- OAuth/SSO integration
- Audit logging

**Key Exports:**
```typescript
import {
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  sendPasswordResetEmail,
  updatePassword
} from '@/core/auth';
```

---

### 2. 🏢 [MULTI-TENANCY](/src/core/multi-tenancy/README.md)

**Responsibilities:**
- Tenant isolation (RLS, queries)
- Tenant context management
- Subdomain routing
- White-label customization
- Workspace management

**Key Exports:**
```typescript
import {
  getCurrentTenant,
  TenantProvider,
  useTenant,
  createTenantQuery,
  getBrandingSettings,
  resolveTenantFromRequest
} from '@/core/multi-tenancy';
```

---

### 3. 💳 [BILLING](/src/core/billing/README.md)

**Responsibilities:**
- Stripe integration
- Subscription lifecycle
- Payment processing
- Invoicing
- Usage tracking
- Stripe Connect (marketplace)

**Key Exports:**
```typescript
import {
  createCheckoutSession,
  getActiveSubscription,
  cancelSubscription,
  getActiveProductsWithPrices,
  formatCurrency
} from '@/core/billing';
```

---

### 4. 🔒 [PERMISSIONS](/src/core/permissions/README.md)

**Responsibilities:**
- Role-Based Access Control (RBAC)
- Permission checking
- UI permission gates
- API protection middleware
- Tenant-scoped permissions

**Key Exports:**
```typescript
import {
  hasPermission,
  requirePermission,
  PermissionGate,
  PERMISSIONS,
  getUserPermissions
} from '@/core/permissions';
```

---

### 5. 🗄️ [DATABASE](/src/core/database/README.md)

**Responsibilities:**
- Database client management
- TypeScript type definitions
- Data access layer (DAL)
- User, tenant, role management
- Query utilities

**Key Exports:**
```typescript
import {
  createClient,
  createAdminClient,
  createBrowserClient,
  getUser,
  getTenant,
  listUsers
} from '@/core/database';
```

---

### 6. 🔧 [SHARED](/src/core/shared/README.md)

**Responsibilities:**
- Common utilities
- Shared TypeScript types
- Application constants
- Helper functions
- Formatters & validators

**Key Exports:**
```typescript
import {
  sleep,
  retry,
  debounce,
  isValidEmail,
  formatDate,
  APP_CONFIG,
  FEATURES
} from '@/core/shared';
```

---

## 🚀 Quick Start

### Option 1: Import from Main Entry Point

```typescript
// Import everything from core
import { 
  signIn,
  getCurrentTenant,
  createCheckoutSession,
  hasPermission,
  createClient 
} from '@/core';
```

### Option 2: Import from Specific Domain

```typescript
// More explicit, better for IDE autocomplete
import { signIn, getCurrentUser } from '@/core/auth';
import { getCurrentTenant } from '@/core/multi-tenancy';
import { createCheckoutSession } from '@/core/billing';
```

### Option 3: Import Domain Namespace

```typescript
// Group imports by domain
import * as Auth from '@/core/auth';
import * as Tenancy from '@/core/multi-tenancy';
import * as Billing from '@/core/billing';

// Usage:
const user = await Auth.getCurrentUser();
const tenant = await Tenancy.getCurrentTenant();
```

---

## 📖 Usage Guidelines

### ✅ DO

1. **Import from domain index files**
   ```typescript
   import { signIn } from '@/core/auth';
   ```

2. **Keep domains loosely coupled**
   ```typescript
   // Auth doesn't directly import from Billing
   // They communicate through well-defined interfaces
   ```

3. **Use TypeScript types**
   ```typescript
   import type { Database } from '@/core/database';
   type User = Database['public']['Tables']['users']['Row'];
   ```

4. **Document your code**
   ```typescript
   /**
    * Creates a new user account
    * @param email - User's email address
    * @param password - User's password
    */
   export async function signUp(email: string, password: string) { ... }
   ```

### ❌ DON'T

1. **Import internal files directly**
   ```typescript
   // ❌ WRONG
   import { something } from '@/core/auth/supabase-provider';
   
   // ✅ CORRECT
   import { something } from '@/core/auth';
   ```

2. **Create circular dependencies**
   ```typescript
   // ❌ WRONG
   // auth imports from billing
   // billing imports from auth
   // = circular dependency!
   ```

3. **Bypass domain abstractions**
   ```typescript
   // ❌ WRONG - Directly accessing Supabase
   import { createClient } from '@supabase/ssr';
   
   // ✅ CORRECT - Using core abstraction
   import { createClient } from '@/core/database';
   ```

---

## 🎯 Architecture Principles

### 1. **Domain-Driven Design**

Each domain represents a **bounded context** with:
- Clear responsibilities
- Well-defined API
- Internal implementation details hidden

### 2. **Separation of Concerns**

```
┌─────────────────────────────────────┐
│        Presentation Layer           │
│    (React Components, Pages)        │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│         Core Domains                │
│   (Business Logic & Services)       │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      Infrastructure Layer           │
│  (Database, APIs, External Services)│
└─────────────────────────────────────┘
```

### 3. **Dependency Flow**

```
Shared ←┐
        │
Auth    ├── Multi-Tenancy
        │
Database┘
        │
        ├── Permissions
        │
        └── Billing
```

**Rules:**
- Lower layers don't depend on higher layers
- Shared has no dependencies
- Database/Auth are foundation layers
- Higher layers can depend on lower layers

### 4. **Provider Abstraction**

Each external service is abstracted:

```typescript
// Auth can use Supabase, WorkOS, Auth0, etc.
import { signIn } from '@/core/auth';

// Billing can use Stripe, Paddle, etc.
import { createCheckoutSession } from '@/core/billing';
```

**Benefits:**
- Easy to swap providers
- Testable without real services
- Consistent API across providers

---

## 📝 Migration Guide

### From Old Structure to New Structure

#### Before:
```typescript
// ❌ Old imports (scattered)
import { signIn } from '@/lib/auth/auth';
import { getTenant } from '@/lib/supabase/tenants';
import { hasPermission } from '@/lib/auth/permissions';
import { stripe } from '@/lib/stripe/config';
```

#### After:
```typescript
// ✅ New imports (organized)
import { signIn } from '@/core/auth';
import { getTenant } from '@/core/multi-tenancy';
import { hasPermission } from '@/core/permissions';
import { stripe } from '@/core/billing';
```

### Migration Steps:

1. ✅ **Update imports** throughout your codebase - **COMPLETE**
2. ✅ **Archive old `src/lib/` files** - **COMPLETE** (moved to `archive/lib/`)
3. ✅ **Update scripts** to use `@/core/*` imports - **COMPLETE**
4. ✅ **Test thoroughly** after migration - **COMPLETE**
5. ✅ **Update documentation** with new import paths - **COMPLETE**

**Note:** Legacy `src/lib/*` files have been archived to `archive/lib/` and should not be used. All application code now uses `@/core/*` imports.

---

## 🧪 Testing

### Domain Testing

```bash
# Test all domains
npm run test src/core

# Test specific domain
npm run test src/core/auth
npm run test src/core/multi-tenancy
npm run test src/core/billing
```

### Integration Testing

```bash
# Test cross-domain interactions
npm run test:integration
```

---

## 📊 Dependencies

### Dependency Map

```
docs/DEPENDENCIES.md
```

This file documents:
- ✅ What each domain depends on
- ✅ What depends on each domain
- ✅ Circular dependency warnings
- ✅ Suggested refactorings

---

## 🔮 Future Enhancements

### Planned Domains

- **📧 Notifications** - Email, SMS, push notifications
- **📊 Analytics** - Event tracking, metrics
- **🔍 Search** - Full-text search, filters
- **📁 Storage** - File upload, management
- **🔄 Integrations** - Third-party API connectors
- **🪝 Webhooks** - Outgoing webhook management

---

## 📚 Additional Resources

- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Modular Monolith](https://www.youtube.com/watch?v=5OjqD-ow8GE)

---

## 💬 Questions?

If you have questions about:
- **Architecture decisions** → See `docs/DEPENDENCIES.md`
- **Specific domains** → See domain-specific README files
- **Migration** → See migration guide above

---

**Built with ❤️ for scalability, maintainability, and developer experience.**


