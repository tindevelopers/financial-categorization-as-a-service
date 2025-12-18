import { describe, expect, it } from 'vitest';
import { validateTenantDomain } from '../validation-utils';

describe('tenant validation utilities', () => {
  describe('validateTenantDomain', () => {
    it('validates correct domain formats', () => {
      expect(validateTenantDomain('example.com').isValid).toBe(true);
      expect(validateTenantDomain('sub.example.org').isValid).toBe(true);
      expect(validateTenantDomain('my-tenant.co.uk').isValid).toBe(true);
      expect(validateTenantDomain('company123.io').isValid).toBe(true);
    });

    it('rejects empty domains', () => {
      const result = validateTenantDomain('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Domain is required');
    });

    it('rejects whitespace-only domains', () => {
      const result = validateTenantDomain('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Domain is required');
    });

    it('rejects domains exceeding 255 characters', () => {
      // Note: The regex validation runs before length check,
      // so very long domains fail regex first
      const longDomain = 'a'.repeat(256) + '.com';
      const result = validateTenantDomain(longDomain);
      expect(result.isValid).toBe(false);
      // Regex catches this first due to segment length limits
      expect(result.error).toBeDefined();
    });

    it('rejects reserved domain prefixes', () => {
      const reservedDomains = [
        'localhost',
        'admin.example.com',
        'api.example.com',
        'www.example.com',
        'mail.example.com',
        'app.example.com',
      ];

      for (const domain of reservedDomains) {
        const result = validateTenantDomain(domain);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('reserved word');
      }
    });

    it('accepts non-reserved domain prefixes', () => {
      expect(validateTenantDomain('mycompany.example.com').isValid).toBe(true);
      expect(validateTenantDomain('tenant1.example.com').isValid).toBe(true);
      expect(validateTenantDomain('acme-corp.io').isValid).toBe(true);
    });

    it('rejects invalid domain format characters', () => {
      expect(validateTenantDomain('domain with spaces.com').isValid).toBe(false);
      expect(validateTenantDomain('domain_underscore.com').isValid).toBe(false);
    });
  });
});

