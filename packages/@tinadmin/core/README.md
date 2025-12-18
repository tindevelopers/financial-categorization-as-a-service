# @tinadmin/core

Core SaaS platform modules: auth, billing, database, multi-tenancy, permissions, email, and shared utilities.

## Installation

```bash
npm install @tinadmin/core
```

## Usage

### Import from main entry point

```typescript
import { signIn, getCurrentTenant, createCheckoutSession } from '@tinadmin/core';
```

### Import from specific domain

```typescript
import { signIn } from '@tinadmin/core/auth';
import { getCurrentTenant } from '@tinadmin/core/multi-tenancy';
import { createCheckoutSession } from '@tinadmin/core/billing';
import { hasPermission } from '@tinadmin/core/permissions';
import { createClient } from '@tinadmin/core/database';
import { sendEmail } from '@tinadmin/core/email';
import { sleep, retry } from '@tinadmin/core/shared';
```

## Domains

### Auth (`@tinadmin/core/auth`)
Authentication, sessions, password management, and audit logging.

### Multi-Tenancy (`@tinadmin/core/multi-tenancy`)
Tenant management, isolation, white-labeling, and subdomain routing.

### Billing (`@tinadmin/core/billing`)
Stripe integration, subscriptions, payments, invoicing, and webhooks.

### Permissions (`@tinadmin/core/permissions`)
Role-Based Access Control (RBAC), permission checking, and access gates.

### Database (`@tinadmin/core/database`)
Database clients, types, and data access layer.

### Email (`@tinadmin/core/email`)
Email service, providers, and templates.

### Shared (`@tinadmin/core/shared`)
Common utilities, types, constants, and helpers.

## Development

```bash
# Build the package
npm run build

# Watch mode
npm run dev

# Clean build artifacts
npm run clean
```

## License

MIT

