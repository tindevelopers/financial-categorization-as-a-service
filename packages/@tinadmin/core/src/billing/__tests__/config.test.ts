import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  isStripeConfigured,
  formatAmountForStripe,
  formatAmountFromStripe,
} from '../config';

describe('billing config utilities', () => {
  describe('isStripeConfigured', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('returns true when STRIPE_SECRET_KEY is set', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
      expect(isStripeConfigured()).toBe(true);
    });

    it('returns false when STRIPE_SECRET_KEY is not set', () => {
      delete process.env.STRIPE_SECRET_KEY;
      expect(isStripeConfigured()).toBe(false);
    });

    it('returns false when STRIPE_SECRET_KEY is empty string', () => {
      process.env.STRIPE_SECRET_KEY = '';
      expect(isStripeConfigured()).toBe(false);
    });
  });

  describe('formatAmountForStripe', () => {
    it('converts USD amounts to cents', () => {
      expect(formatAmountForStripe(10.99, 'USD')).toBe(1099);
      expect(formatAmountForStripe(100, 'USD')).toBe(10000);
      expect(formatAmountForStripe(0.5, 'USD')).toBe(50);
    });

    it('converts EUR amounts to cents', () => {
      expect(formatAmountForStripe(25.50, 'EUR')).toBe(2550);
      expect(formatAmountForStripe(99.99, 'EUR')).toBe(9999);
    });

    it('converts GBP amounts to pence', () => {
      expect(formatAmountForStripe(15.75, 'GBP')).toBe(1575);
    });

    it('handles zero-decimal currencies correctly', () => {
      // JPY is a zero-decimal currency
      expect(formatAmountForStripe(1000, 'JPY')).toBe(1000);
      expect(formatAmountForStripe(500, 'JPY')).toBe(500);
    });

    it('handles edge cases', () => {
      expect(formatAmountForStripe(0, 'USD')).toBe(0);
      expect(formatAmountForStripe(0.01, 'USD')).toBe(1);
    });
  });

  describe('formatAmountFromStripe', () => {
    it('converts cents to USD amounts', () => {
      expect(formatAmountFromStripe(1099, 'USD')).toBe(10.99);
      expect(formatAmountFromStripe(10000, 'USD')).toBe(100);
      expect(formatAmountFromStripe(50, 'USD')).toBe(0.5);
    });

    it('converts cents to EUR amounts', () => {
      expect(formatAmountFromStripe(2550, 'EUR')).toBe(25.50);
      expect(formatAmountFromStripe(9999, 'EUR')).toBe(99.99);
    });

    it('handles zero-decimal currencies correctly', () => {
      // JPY is a zero-decimal currency
      expect(formatAmountFromStripe(1000, 'JPY')).toBe(1000);
      expect(formatAmountFromStripe(500, 'JPY')).toBe(500);
    });

    it('handles edge cases', () => {
      expect(formatAmountFromStripe(0, 'USD')).toBe(0);
      expect(formatAmountFromStripe(1, 'USD')).toBe(0.01);
    });
  });
});

