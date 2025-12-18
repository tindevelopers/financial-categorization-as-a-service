/**
 * Email Provider Factory
 * 
 * Creates and initializes email provider instances based on configuration
 */

import { EmailProvider, ProviderConfig } from '../email-interface';
import { validateProviderConfig } from './provider-config';

// Import providers (will be implemented next)
import { ResendProvider } from '../providers/resend-provider';
import { AmazonSESProvider } from '../providers/amazon-ses-provider';
import { InbucketProvider } from '../providers/inbucket-provider';

/**
 * Create an email provider instance
 */
export async function createProvider(config: ProviderConfig): Promise<EmailProvider> {
  // Validate configuration
  const validation = validateProviderConfig(config);
  if (!validation.valid) {
    throw new Error(`Invalid provider configuration: ${validation.errors.join(', ')}`);
  }
  
  // Create provider instance based on type
  let provider: EmailProvider;
  
  switch (config.type) {
    case 'resend':
      provider = new ResendProvider();
      break;
      
    case 'sendgrid':
      // Will be implemented if needed
      throw new Error('SendGrid provider not yet implemented. Use Resend or Amazon SES.');
      
    case 'amazon_ses':
      provider = new AmazonSESProvider();
      break;
      
    case 'brevo':
      // Will be implemented if needed
      throw new Error('Brevo provider not yet implemented. Use Resend or Amazon SES.');
      
    case 'gohighlevel':
      // Will be implemented if needed
      throw new Error('GoHighLevel provider not yet implemented. Use Resend or Amazon SES.');
      
    case 'postmark':
      // Will be implemented if needed
      throw new Error('Postmark provider not yet implemented. Use Resend or Amazon SES.');
      
    case 'mailgun':
      // Will be implemented if needed
      throw new Error('Mailgun provider not yet implemented. Use Resend or Amazon SES.');
      
    case 'inbucket':
      provider = new InbucketProvider();
      break;
      
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
  
  // Initialize provider
  await provider.initialize(config);
  
  // Verify provider is healthy
  const health = await provider.healthCheck();
  if (!health.healthy) {
    throw new Error(`Provider ${config.type} failed health check: ${health.error}`);
  }
  
  return provider;
}

/**
 * Provider registry (singleton pattern)
 * Keeps track of initialized providers to avoid re-initialization
 */
class ProviderRegistry {
  private providers: Map<string, EmailProvider> = new Map();
  
  async getOrCreate(config: ProviderConfig): Promise<EmailProvider> {
    const key = this.getProviderKey(config);
    
    if (this.providers.has(key)) {
      return this.providers.get(key)!;
    }
    
    const provider = await createProvider(config);
    this.providers.set(key, provider);
    return provider;
  }
  
  private getProviderKey(config: ProviderConfig): string {
    // Create a unique key for this provider configuration
    return `${config.type}:${JSON.stringify(config.credentials)}`;
  }
  
  clear() {
    this.providers.clear();
  }
}

// Export singleton instance
export const providerRegistry = new ProviderRegistry();




