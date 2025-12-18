/**
 * BILLING DOMAIN
 * 
 * Central billing and subscription module for the SaaS platform.
 * Integrates with Stripe for payments, subscriptions, and invoicing.
 * 
 * PUBLIC API - Only import from this file!
 */

// ============================================================================
// STRIPE CONFIGURATION
// ============================================================================
export { stripe, stripeConfig } from './config';
import { stripeConfig } from './config';

// ============================================================================
// STRIPE CLIENT (Client-side)
// ============================================================================
export { getStripe } from './client';

// ============================================================================
// CUSTOMERS
// ============================================================================
export {
  createOrRetrieveCustomer,
  getCustomer,
  updateCustomer,
} from './customers';

// ============================================================================
// CHECKOUT & BILLING PORTAL
// ============================================================================
export {
  createCheckoutSession,
  createBillingPortalSession,
} from './checkout';

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================
export {
  getActiveSubscription,
  cancelSubscription,
  resumeSubscription,
  updateSubscription,
} from './subscriptions';

// ============================================================================
// PRODUCTS & PRICING
// ============================================================================
export {
  getProducts,
  getProduct,
  getPrices,
  syncProducts,
} from './products';

// ============================================================================
// PAYMENT METHODS
// ============================================================================
export {
  getPaymentMethods,
  setDefaultPaymentMethod,
  deletePaymentMethod,
  createSetupIntent,
} from './payment-methods';

// ============================================================================
// USAGE TRACKING (Metered Billing)
// ============================================================================
export {
  recordUsage,
  getUsageRecords,
  trackUsageEvent,
  getCurrentUsage,
} from './usage';

// ============================================================================
// STRIPE CONNECT (Multi-Tenant Marketplace)
// ============================================================================
export {
  createConnectAccount,
  getConnectAccount,
  createConnectAccountLink,
  createConnectLoginLink,
  updateConnectAccount,
  createConnectedPayment,
  createPayout,
  getConnectAccountBalance,
} from './connect';

// ============================================================================
// WEBHOOKS
// ============================================================================
// Note: Webhook handler is exported separately for Next.js API routes
// Import from '@/core/billing/webhooks' in your API route

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

/**
 * Convert cents to dollars
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Convert dollars to cents
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Get subscription status label
 */
export function getSubscriptionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Active',
    past_due: 'Past Due',
    unpaid: 'Unpaid',
    canceled: 'Canceled',
    incomplete: 'Incomplete',
    incomplete_expired: 'Incomplete Expired',
    trialing: 'Trial',
    paused: 'Paused',
  };
  return labels[status] || status;
}

/**
 * Get subscription status color
 */
export function getSubscriptionStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'green',
    past_due: 'orange',
    unpaid: 'red',
    canceled: 'gray',
    incomplete: 'yellow',
    incomplete_expired: 'red',
    trialing: 'blue',
    paused: 'gray',
  };
  return colors[status] || 'gray';
}

/**
 * Check if Stripe Connect is enabled
 */
export function isStripeConnectEnabled(): boolean {
  return stripeConfig.connect.enabled;
}

/**
 * Get billing currency from environment or default
 */
export function getDefaultCurrency(): string {
  return process.env.NEXT_PUBLIC_STRIPE_CURRENCY || 'usd';
}

/**
 * Check if a subscription is active (including trial)
 */
export function isSubscriptionActive(status: string): boolean {
  return ['active', 'trialing'].includes(status);
}

/**
 * Check if a subscription requires payment
 */
export function requiresPayment(status: string): boolean {
  return ['past_due', 'unpaid', 'incomplete'].includes(status);
}



