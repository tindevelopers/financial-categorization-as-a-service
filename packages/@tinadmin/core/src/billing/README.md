# 💳 BILLING DOMAIN

Central billing and subscription module for the SaaS platform.

## 📁 Structure

```
billing/
├── index.ts              # PUBLIC API - Import only from here!
├── config.ts             # Stripe configuration
├── client.ts             # Client-side Stripe loader
├── customers.ts          # Customer management
├── checkout.ts           # Checkout & billing portal
├── subscriptions.ts      # Subscription management
├── products.ts           # Products & pricing
├── payment-methods.ts    # Payment method management
├── usage.ts              # Usage tracking (metered billing)
├── connect.ts            # Stripe Connect (marketplace)
└── webhooks.ts           # Stripe webhook handler
```

## 🎯 Purpose

This domain handles:
- ✅ Stripe customer management
- ✅ Subscription lifecycle (create, update, cancel, resume)
- ✅ One-time payments
- ✅ Payment method management
- ✅ Usage-based billing
- ✅ Invoicing
- ✅ Stripe Connect (multi-tenant marketplace)
- ✅ Webhook processing

## 📦 Public API

### Checkout Flow

```typescript
import { createCheckoutSession } from '@/core/billing';

// Create a checkout session
const { url } = await createCheckoutSession(
  tenantId,
  priceId,
  'https://app.com/success',
  'https://app.com/cancel'
);

// Redirect user to Stripe Checkout
router.push(url);
```

### Billing Portal

```typescript
import { createBillingPortalSession } from '@/core/billing';

// Open Stripe Customer Portal
const { url } = await createBillingPortalSession(
  tenantId,
  'https://app.com/billing'
);

router.push(url);
```

### Subscription Management

```typescript
import {
  getActiveSubscription,
  cancelSubscription,
  updateSubscriptionPlan
} from '@/core/billing';

// Get active subscription
const { subscription } = await getActiveSubscription(tenantId);

// Cancel subscription
await cancelSubscription(tenantId, subscriptionId);

// Upgrade/downgrade plan
await updateSubscriptionPlan(tenantId, subscriptionId, newPriceId);
```

### Products & Pricing

```typescript
import { getActiveProductsWithPrices } from '@/core/billing';

// Get all products with prices
const { products } = await getActiveProductsWithPrices();

products.forEach(product => {
  console.log(product.name, product.prices);
});
```

### Payment Methods

```typescript
import {
  getPaymentMethods,
  setDefaultPaymentMethod
} from '@/core/billing';

// Get all payment methods
const { paymentMethods } = await getPaymentMethods(tenantId);

// Set default
await setDefaultPaymentMethod(tenantId, paymentMethodId);
```

### Usage Tracking (Metered Billing)

```typescript
import { recordUsage, getUsageForPeriod } from '@/core/billing';

// Record usage (e.g., API calls, storage)
await recordUsage(
  tenantId,
  subscriptionId,
  subscriptionItemId,
  quantity
);

// Get usage for a period
const usage = await getUsageForPeriod(
  tenantId,
  startDate,
  endDate
);
```

### Stripe Connect (Marketplace)

```typescript
import {
  createConnectAccount,
  getConnectAccountStatus
} from '@/core/billing';

// Create a connected account for a tenant
const { accountId, onboardingUrl } = await createConnectAccount(
  tenantId,
  'admin@tenant.com',
  'company'
);

// Check status
const { account, onboardingNeeded } = await getConnectAccountStatus(tenantId);
```

## 🔌 Stripe Integration

### Configuration

```env
# .env.local

# Stripe Keys
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Webhook Secret (from Stripe Dashboard)
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Connect (Optional)
STRIPE_CONNECT_ENABLED=true

# Default Currency
NEXT_PUBLIC_STRIPE_CURRENCY=usd
```

### Webhook Setup

1. Create webhook in [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Point to: `https://yourapp.com/api/webhooks/stripe`
3. Select events:
   - `customer.subscription.*`
   - `invoice.*`
   - `payment_method.*`
   - `checkout.session.completed`

```typescript
// In src/app/api/webhooks/stripe/route.ts
import { POST } from '@/core/billing/webhooks';
export { POST };
```

## 🔄 Dependencies

### This domain depends on:
- **Multi-Tenancy**: Tenant identification
- **Auth**: User identification
- **Database**: Storing subscription data

### Other domains depend on this for:
- **Permissions**: Checking subscription tier
- **Multi-Tenancy**: Billing per tenant
- **Auth**: Payment-gated features

## 🏗️ Database Schema

```sql
-- Stripe Customers
CREATE TABLE stripe_customers (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  stripe_customer_id TEXT UNIQUE,
  email TEXT,
  name TEXT
);

-- Stripe Subscriptions
CREATE TABLE stripe_subscriptions (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_price_id TEXT,
  status TEXT,
  plan_name TEXT,
  plan_price INTEGER,
  current_period_end TIMESTAMP WITH TIME ZONE
);

-- Stripe Invoices
CREATE TABLE stripe_invoices (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  stripe_invoice_id TEXT UNIQUE,
  amount_due INTEGER,
  status TEXT,
  invoice_pdf TEXT
);
```

## 🎯 Subscription Lifecycle

```
1. User selects plan → Create checkout session
2. User completes payment → checkout.session.completed webhook
3. Stripe creates subscription → customer.subscription.created webhook
4. Subscription updates → customer.subscription.updated webhook
5. Invoice generated → invoice.payment_succeeded webhook
6. User cancels → customer.subscription.deleted webhook
```

## 💡 Best Practices

1. **Always use webhooks** for subscription updates
   - Don't trust client-side responses
   - Webhooks are the source of truth

2. **Handle webhook idempotency**
   - Store `stripe_event_id` to prevent duplicate processing

3. **Test with Stripe Test Mode**
   - Use test keys during development
   - Use [Stripe CLI](https://stripe.com/docs/stripe-cli) for local webhooks

4. **Secure webhook endpoint**
   - Always verify signature with `STRIPE_WEBHOOK_SECRET`

5. **Handle failed payments gracefully**
   - Monitor `invoice.payment_failed` events
   - Implement dunning (retry) logic

## ⚠️ Important Rules

1. **DO NOT** import internal files directly
   ```typescript
   // ❌ WRONG
   import { something } from '@/core/billing/subscriptions';
   
   // ✅ CORRECT
   import { something } from '@/core/billing';
   ```

2. **NEVER** expose Stripe secret keys to the client

3. **ALWAYS** verify webhook signatures

4. **ALWAYS** handle webhook errors gracefully

## 🧪 Testing

### Local Webhook Testing

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger payment_intent.succeeded
```

### Test Cards

```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
3D Secure: 4000 0025 0000 3155
```

## 📊 Monitoring

### Key Metrics to Track

- MRR (Monthly Recurring Revenue)
- Churn rate
- Failed payment rate
- Average subscription value
- Trial conversion rate

### Recommended Tools

- [Stripe Dashboard](https://dashboard.stripe.com) - Built-in analytics
- [ChartMogul](https://chartmogul.com) - Subscription analytics
- [Baremetrics](https://baremetrics.com) - SaaS metrics

## 📚 Additional Resources

- [Stripe Docs](https://stripe.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Connect Docs](https://stripe.com/docs/connect)
- [SaaS Billing Best Practices](https://stripe.com/guides/billing-for-saas)




