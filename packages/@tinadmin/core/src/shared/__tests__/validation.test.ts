import { describe, expect, it } from 'vitest';
import {
  isValidEmail,
  isValidUrl,
  isValidDomain,
  isValidUUID,
  isValidSlug,
  sanitizeString,
  validateRequired,
  validateLength,
} from '../validation';

describe('shared validation utilities', () => {
  describe('isValidEmail', () => {
    it('validates correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.org')).toBe(true);
      expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
    });

    it('rejects invalid email formats', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('no@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
      expect(isValidEmail('spaces in@email.com')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('validates correct URL formats', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('https://sub.domain.com/path?query=1')).toBe(true);
    });

    it('rejects invalid URL formats', () => {
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('example.com')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false);
    });
  });

  describe('isValidDomain', () => {
    it('validates correct domain formats', () => {
      expect(isValidDomain('example.com')).toBe(true);
      expect(isValidDomain('sub.example.org')).toBe(true);
      expect(isValidDomain('my-site.co.uk')).toBe(true);
    });

    it('rejects invalid domain formats', () => {
      expect(isValidDomain('')).toBe(false);
      expect(isValidDomain('localhost')).toBe(false);
      expect(isValidDomain('-invalid.com')).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('validates correct UUID formats', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('rejects invalid UUID formats', () => {
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123e4567-e89b-12d3-a456')).toBe(false);
      expect(isValidUUID('123e4567e89b12d3a456426614174000')).toBe(false);
    });
  });

  describe('isValidSlug', () => {
    it('validates correct slug formats', () => {
      expect(isValidSlug('my-slug')).toBe(true);
      expect(isValidSlug('test123')).toBe(true);
      expect(isValidSlug('multiple-word-slug')).toBe(true);
    });

    it('rejects invalid slug formats', () => {
      expect(isValidSlug('')).toBe(false);
      expect(isValidSlug('UPPERCASE')).toBe(false);
      expect(isValidSlug('has spaces')).toBe(false);
      expect(isValidSlug('-starts-with-dash')).toBe(false);
      expect(isValidSlug('ends-with-dash-')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('trims whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
      expect(sanitizeString('\n\ttest\n\t')).toBe('test');
    });

    it('removes HTML-like characters', () => {
      expect(sanitizeString('<script>alert()</script>')).toBe('scriptalert()/script');
      expect(sanitizeString('hello<br>world')).toBe('hellobrworld');
    });

    it('handles normal strings unchanged', () => {
      expect(sanitizeString('Hello World!')).toBe('Hello World!');
    });
  });

  describe('validateRequired', () => {
    it('validates all required fields present', () => {
      const data = { name: 'John', email: 'john@example.com' };
      const result = validateRequired(data, ['name', 'email']);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns errors for missing fields', () => {
      const data = { name: 'John', email: '' };
      const result = validateRequired(data, ['name', 'email', 'phone']);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('email is required');
      expect(result.errors).toContain('phone is required');
    });

    it('handles null and undefined values', () => {
      const data = { name: null, email: undefined };
      const result = validateRequired(data, ['name', 'email']);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('validateLength', () => {
    it('validates strings within length bounds', () => {
      const result = validateLength('hello', 1, 10, 'Name');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects strings below minimum length', () => {
      const result = validateLength('ab', 3, 10, 'Name');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Name must be at least 3 characters');
    });

    it('rejects strings above maximum length', () => {
      const result = validateLength('this is way too long', 1, 10, 'Name');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Name must be at most 10 characters');
    });
  });
});

