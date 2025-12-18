/**
 * Tenant Validation Utilities (Client-Safe)
 * 
 * Pure validation functions that don't require server-only dependencies
 * These can be used in client components and tests
 */

/**
 * Validate tenant domain format
 * This is a pure validation function that doesn't require server-only code
 */
export function validateTenantDomain(domain: string): {
  isValid: boolean;
  error?: string;
} {
  if (!domain || domain.trim().length === 0) {
    return {
      isValid: false,
      error: "Domain is required",
    };
  }

  // Basic domain format validation
  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
  
  if (!domainRegex.test(domain)) {
    return {
      isValid: false,
      error: "Invalid domain format. Domain must be a valid domain name.",
    };
  }

  // Check length
  if (domain.length > 255) {
    return {
      isValid: false,
      error: "Domain must be 255 characters or less",
    };
  }

  // Check for reserved domains
  const reservedDomains = [
    "localhost",
    "local",
    "test",
    "admin",
    "api",
    "www",
    "mail",
    "ftp",
    "app",
    "www2",
    "ns1",
    "ns2",
  ];

  const domainParts = domain.split(".");
  const firstPart = domainParts[0]?.toLowerCase();

  if (reservedDomains.includes(firstPart || "")) {
    return {
      isValid: false,
      error: `Domain cannot start with reserved word: ${firstPart}`,
    };
  }

  return {
    isValid: true,
  };
}
