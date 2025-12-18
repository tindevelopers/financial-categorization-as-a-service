/**
 * Email Provider Configuration
 * 
 * Handles loading and validating email provider configurations
 * from environment variables or database
 */

import { EmailProviderType, ProviderConfig, ProviderSettings } from '../email-interface';

/**
 * Get provider configuration from environment variables
 */
export function getProviderConfigFromEnv(providerType?: EmailProviderType): ProviderConfig | null {
  const type = (providerType || process.env.EMAIL_PROVIDER || 'resend') as EmailProviderType;
  
  switch (type) {
    case 'resend':
      return {
        type: 'resend',
        credentials: {
          apiKey: process.env.RESEND_API_KEY,
        },
        settings: {
          defaultFrom: process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com',
          sandbox: process.env.RESEND_SANDBOX === 'true',
        },
      };
      
    case 'sendgrid':
      return {
        type: 'sendgrid',
        credentials: {
          apiKey: process.env.SENDGRID_API_KEY,
        },
        settings: {
          defaultFrom: process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com',
          sandbox: process.env.SENDGRID_SANDBOX === 'true',
        },
      };
      
    case 'amazon_ses':
      return {
        type: 'amazon_ses',
        credentials: {
          accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1',
        },
        settings: {
          defaultFrom: process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com',
        },
      };
      
    case 'brevo':
      return {
        type: 'brevo',
        credentials: {
          apiKey: process.env.BREVO_API_KEY,
        },
        settings: {
          defaultFrom: process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com',
        },
      };
      
    case 'postmark':
      return {
        type: 'postmark',
        credentials: {
          serverToken: process.env.POSTMARK_SERVER_TOKEN,
        },
        settings: {
          defaultFrom: process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com',
        },
      };
      
    case 'inbucket':
      return {
        type: 'inbucket',
        credentials: {
          url: process.env.INBUCKET_URL || 'http://127.0.0.1:54324',
        },
        settings: {
          defaultFrom: 'noreply@localhost',
        },
      };
      
    default:
      console.warn(`Unknown email provider type: ${type}`);
      return null;
  }
}

/**
 * Get fallback provider configuration
 */
export function getFallbackProviderConfig(): ProviderConfig | null {
  const fallbackType = process.env.FALLBACK_EMAIL_PROVIDER as EmailProviderType;
  if (!fallbackType) return null;
  
  return getProviderConfigFromEnv(fallbackType);
}

/**
 * Validate provider configuration
 */
export function validateProviderConfig(config: ProviderConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.type) {
    errors.push('Provider type is required');
  }
  
  if (!config.credentials) {
    errors.push('Provider credentials are required');
  }
  
  // Type-specific validation
  switch (config.type) {
    case 'resend':
      if (!config.credentials.apiKey) {
        errors.push('Resend API key is required');
      }
      break;
      
    case 'sendgrid':
      if (!config.credentials.apiKey) {
        errors.push('SendGrid API key is required');
      }
      break;
      
    case 'amazon_ses':
      if (!config.credentials.accessKeyId) {
        errors.push('AWS SES Access Key ID is required');
      }
      if (!config.credentials.secretAccessKey) {
        errors.push('AWS SES Secret Access Key is required');
      }
      if (!config.credentials.region) {
        errors.push('AWS SES Region is required');
      }
      break;
      
    case 'brevo':
      if (!config.credentials.apiKey) {
        errors.push('Brevo API key is required');
      }
      break;
      
    case 'postmark':
      if (!config.credentials.serverToken) {
        errors.push('Postmark Server Token is required');
      }
      break;
      
    case 'inbucket':
      if (!config.credentials.url) {
        errors.push('Inbucket URL is required');
      }
      break;
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get default provider settings
 */
export function getDefaultSettings(): ProviderSettings {
  return {
    timeout: 30000, // 30 seconds
    retries: 3,
    rateLimit: {
      maxPerSecond: 10,
      maxPerMinute: 100,
      maxPerHour: 1000,
    },
  };
}




