# 🔐 AUTH DOMAIN

Central authentication module for the SaaS platform.

## 📁 Structure

```
auth/
├── index.ts                  # PUBLIC API - Import only from here!
├── auth-interface.ts         # Provider-agnostic interface
├── supabase-provider.ts      # Supabase implementation
├── actions.ts                # Server actions for auth
├── password.ts               # Password management
└── audit-log.ts             # Authentication audit logging
```

## 🎯 Purpose

This domain handles:
- ✅ User authentication (sign in, sign up, sign out)
- ✅ Session management
- ✅ Password management (reset, update)
- ✅ OAuth/SSO integration
- ✅ Multi-factor authentication
- ✅ Audit logging for security

## 📦 Public API

### Authentication

```typescript
import { signIn, signUp, signOut, getCurrentUser } from '@/core/auth';

// Sign in
const session = await signIn('user@example.com', 'password');

// Sign up
const user = await signUp('user@example.com', 'password');

// Sign out
await signOut();

// Get current user
const user = await getCurrentUser();
```

### Password Management

```typescript
import { 
  sendPasswordResetEmail, 
  updatePassword,
  resetPasswordWithToken 
} from '@/core/auth';

// Send reset email
await sendPasswordResetEmail('user@example.com');

// Update password (authenticated)
await updatePassword('currentPassword', 'newPassword');

// Reset with token (from email link)
await resetPasswordWithToken('newPassword');
```

### Server Actions

```typescript
import { signInAction, signUpAction } from '@/core/auth';

// In a form submission
<form action={signInAction}>
  ...
</form>
```

## 🔌 Provider Support

Currently implemented:
- ✅ **Supabase** (Active)

Planned:
- 🔜 **WorkOS** (Enterprise SSO)
- 🔜 **Auth0** (Full-featured)
- 🔜 **AWS Cognito** (AWS ecosystem)
- 🔜 **Firebase Auth** (Google ecosystem)

## 🔄 Dependencies

### This domain depends on:
- **Database**: User storage and retrieval
- **Multi-Tenancy**: Tenant context for user association

### Other domains depend on this for:
- **Permissions**: User identification for RBAC
- **Billing**: User identification for subscriptions
- **Multi-Tenancy**: User-tenant relationship
- **Audit Logging**: User tracking

## 🚀 Adding a New Provider

1. Create `{provider}-provider.ts`
2. Implement the `AuthProvider` interface
3. Export functions in `index.ts`
4. Update environment configuration
5. Test all authentication flows

## ⚠️ Important Rules

1. **DO NOT** import internal files directly
   ```typescript
   // ❌ WRONG
   import { something } from '@/core/auth/supabase-provider';
   
   // ✅ CORRECT
   import { something } from '@/core/auth';
   ```

2. **DO NOT** mix auth providers in the same request

3. **ALWAYS** use server actions for client-side forms

4. **ALWAYS** log authentication events for security

## 📝 Configuration

```env
# .env.local
NEXT_PUBLIC_AUTH_PROVIDER=supabase  # or workos, auth0, cognito

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# WorkOS (when implemented)
WORKOS_API_KEY=...
WORKOS_CLIENT_ID=...
```

## 🧪 Testing

```bash
# Test auth flows
npm run test src/core/auth

# Test specific provider
npm run test src/core/auth/supabase-provider.test.ts
```

## 📚 Additional Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [WorkOS Docs](https://workos.com/docs)
- [Auth0 Docs](https://auth0.com/docs)
- [AWS Cognito Docs](https://docs.aws.amazon.com/cognito/)




