# 🔧 SHARED DOMAIN

Common utilities, types, and constants used across all domains.

## 📁 Structure

```
shared/
├── index.ts       # PUBLIC API - Import only from here!
├── utils.ts       # Common utility functions
└── types/         # Shared TypeScript types
```

## 🎯 Purpose

This domain provides:
- ✅ Common utility functions
- ✅ Shared TypeScript types
- ✅ Application-wide constants
- ✅ Helper functions
- ✅ Formatters and validators

## 📦 Public API

### Constants

```typescript
import { APP_CONFIG, FEATURES, ENV } from '@/core/shared';

console.log(APP_CONFIG.NAME);        // 'SaaS Admin'
console.log(APP_CONFIG.VERSION);     // '1.0.0'
console.log(FEATURES.MULTI_TENANT);  // true/false
console.log(ENV.IS_PROD);            // true/false
```

### Utility Functions

```typescript
import {
  sleep,
  retry,
  debounce,
  throttle,
  deepClone,
  generateId,
  formatDate,
  isValidEmail,
  slugify,
  capitalize,
  truncate
} from '@/core/shared';

// Sleep
await sleep(1000); // Wait 1 second

// Retry with backoff
const data = await retry(
  () => fetchData(),
  { maxAttempts: 3, delay: 1000, backoff: 2 }
);

// Debounce (useful for search)
const debouncedSearch = debounce(search, 300);

// Generate ID
const id = generateId(); // Random 16-char string

// Format date
const formatted = formatDate(new Date(), 'long');

// Validate email
const valid = isValidEmail('user@example.com');

// Slugify
const slug = slugify('Hello World!'); // 'hello-world'
```

### TypeScript Types

```typescript
import type {
  ApiResponse,
  PaginationParams,
  PaginatedResponse,
  SortOptions,
  FilterOptions
} from '@/core/shared';

// API response
const response: ApiResponse<User> = {
  success: true,
  data: user,
};

// Paginated response
const pagedUsers: PaginatedResponse<User> = {
  success: true,
  data: users,
  meta: {
    page: 1,
    limit: 10,
    total: 100,
    totalPages: 10,
  },
};
```

## 💡 Best Practices

1. **Use shared utilities** instead of duplicating code
   ```typescript
   // ✅ CORRECT
   import { isValidEmail } from '@/core/shared';
   const valid = isValidEmail(email);
   
   // ❌ WRONG - Duplicating logic
   const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
   ```

2. **Use shared types** for consistency
   ```typescript
   // ✅ CORRECT
   import type { ApiResponse } from '@/core/shared';
   function api(): ApiResponse<User> { ... }
   
   // ❌ WRONG - Custom response shape
   function api(): { ok: boolean; user?: User; err?: string } { ... }
   ```

3. **Add new utilities** to shared domain instead of domain-specific
   - If 2+ domains need it → Add to shared
   - If only 1 domain needs it → Keep in that domain

## ⚠️ Important Rules

1. **DO NOT** import internal files directly
   ```typescript
   // ❌ WRONG
   import { something } from '@/core/shared/utils';
   
   // ✅ CORRECT
   import { something } from '@/core/shared';
   ```

2. **Keep utilities pure** (no side effects)

3. **Document all utility functions** with JSDoc

4. **Add tests** for new utilities

## 📚 Additional Resources

- [TypeScript Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
- [Lodash](https://lodash.com/) - Alternative utility library




