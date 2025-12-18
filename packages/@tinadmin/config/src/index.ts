/**
 * @tinadmin/config
 * 
 * Shared configuration for TinAdmin SaaS platform
 */

export const APP_CONFIG = {
  name: 'TinAdmin SaaS',
  version: '1.0.0',
  description: 'Enterprise-ready SaaS admin dashboard',
} as const;

export const FEATURES = {
  multiTenant: true,
  billing: true,
  crm: true,
  analytics: true,
  whiteLabel: true,
} as const;

export type AppConfig = typeof APP_CONFIG;
export type Features = typeof FEATURES;

