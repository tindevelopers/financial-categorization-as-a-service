/**
 * Email Service - Main Orchestrator
 * 
 * This is the main service that applications interact with.
 * It handles provider selection, fallback, retry logic, and white-label application.
 */

import {
  EmailProvider,
  SendEmailParams,
  SendEmailResult,
  EmailTemplateProps,
} from './email-interface';
import {
  getProviderConfigFromEnv,
  getFallbackProviderConfig,
} from './config/provider-config';
import { providerRegistry } from './config/provider-factory';

/**
 * Email Service Configuration
 */
interface EmailServiceConfig {
  maxRetries?: number;
  retryDelay?: number; // milliseconds
  useFallback?: boolean;
  logSends?: boolean;
}

const DEFAULT_CONFIG: EmailServiceConfig = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second, will use exponential backoff
  useFallback: true,
  logSends: true,
};

/**
 * Send a single email
 */
export async function sendEmail(
  params: SendEmailParams,
  config: EmailServiceConfig = DEFAULT_CONFIG
): Promise<SendEmailResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Apply white-label if tenant ID is provided
  const emailParams = await applyWhiteLabel(params);
  
  // Get primary provider
  const providerConfig = getProviderConfigFromEnv();
  if (!providerConfig) {
    throw new Error('No email provider configured. Set EMAIL_PROVIDER in environment variables.');
  }
  
  try {
    const provider = await providerRegistry.getOrCreate(providerConfig);
    const result = await sendWithRetry(provider, emailParams, mergedConfig.maxRetries!, mergedConfig.retryDelay!);
    
    // Log if successful
    if (result.success && mergedConfig.logSends) {
      await logEmailSend(result, emailParams);
    }
    
    return result;
  } catch (error) {
    console.error('[Email Service] Primary provider failed:', error);
    
    // Try fallback provider if enabled
    if (mergedConfig.useFallback) {
      const fallbackConfig = getFallbackProviderConfig();
      if (fallbackConfig) {
        console.log('[Email Service] Attempting fallback provider...');
        try {
          const fallbackProvider = await providerRegistry.getOrCreate(fallbackConfig);
          const result = await sendWithRetry(
            fallbackProvider, 
            emailParams, 
            mergedConfig.maxRetries!, 
            mergedConfig.retryDelay!
          );
          
          if (result.success && mergedConfig.logSends) {
            await logEmailSend(result, emailParams);
          }
          
          return result;
        } catch (fallbackError) {
          console.error('[Email Service] Fallback provider also failed:', fallbackError);
        }
      }
    }
    
    // Both primary and fallback failed
    return {
      success: false,
      provider: 'Failed',
      timestamp: new Date(),
      error: {
        code: 'ALL_PROVIDERS_FAILED',
        message: 'All email providers failed to send the email',
        details: error,
      },
    };
  }
}

/**
 * Send multiple emails (bulk send)
 */
export async function sendBulkEmails(
  emails: SendEmailParams[],
  config: EmailServiceConfig = DEFAULT_CONFIG
): Promise<SendEmailResult[]> {
  const providerConfig = getProviderConfigFromEnv();
  if (!providerConfig) {
    throw new Error('No email provider configured');
  }
  
  try {
    const provider = await providerRegistry.getOrCreate(providerConfig);
    
    // Apply white-label to all emails
    const emailsWithWhiteLabel = await Promise.all(
      emails.map(email => applyWhiteLabel(email))
    );
    
    const results = await provider.sendBulkEmails(emailsWithWhiteLabel);
    
    // Log successful sends
    if (config.logSends) {
      for (let i = 0; i < results.length; i++) {
        if (results[i].success) {
          await logEmailSend(results[i], emailsWithWhiteLabel[i]);
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error('[Email Service] Bulk send failed:', error);
    
    // Return failure for all emails
    return emails.map(() => ({
      success: false,
      provider: 'Failed',
      timestamp: new Date(),
      error: {
        code: 'BULK_SEND_FAILED',
        message: 'Bulk email send failed',
        details: error,
      },
    }));
  }
}

/**
 * Send email using a React Email template
 */
export async function sendTemplateEmail<T extends EmailTemplateProps>(
  params: Omit<SendEmailParams, 'html' | 'text'>,
  TemplateComponent: React.ComponentType<T>,
  templateProps: T,
  config?: EmailServiceConfig
): Promise<SendEmailResult> {
  try {
    // Render template to HTML
    const html = await renderTemplate(TemplateComponent, templateProps);
    const text = await renderTemplate(TemplateComponent, templateProps, { plainText: true });
    
    // Send email with rendered template
    return await sendEmail(
      {
        ...params,
        html,
        text,
      },
      config
    );
  } catch (error) {
    console.error('[Email Service] Template rendering failed:', error);
    return {
      success: false,
      provider: 'Template Render Failed',
      timestamp: new Date(),
      error: {
        code: 'TEMPLATE_RENDER_FAILED',
        message: 'Failed to render email template',
        details: error,
      },
    };
  }
}

/**
 * Send email with retry logic
 */
async function sendWithRetry(
  provider: EmailProvider,
  params: SendEmailParams,
  maxRetries: number,
  baseDelay: number
): Promise<SendEmailResult> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await provider.sendEmail(params);
      
      if (result.success) {
        return result;
      }
      
      // If not successful but no exception, treat as error
      lastError = result.error;
      
      // Check if we should retry based on error code
      if (!shouldRetry(result.error)) {
        return result;
      }
      
    } catch (error) {
      lastError = error;
    }
    
    // If not the last attempt, wait before retrying
    if (attempt < maxRetries) {
      const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
      console.log(`[Email Service] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await sleep(delay);
    }
  }
  
  // All retries exhausted
  return {
    success: false,
    provider: provider.name,
    timestamp: new Date(),
    error: {
      code: 'MAX_RETRIES_EXCEEDED',
      message: `Failed after ${maxRetries} retries`,
      details: lastError,
    },
  };
}

/**
 * Determine if an error is retryable
 */
function shouldRetry(error?: any): boolean {
  if (!error) return true;
  
  const nonRetryableCodes = [
    'INVALID_EMAIL',
    'INVALID_SENDER',
    'DOMAIN_NOT_VERIFIED',
    'UNAUTHORIZED',
    'FORBIDDEN',
  ];
  
  return !nonRetryableCodes.includes(error.code);
}

/**
 * Apply white-label branding to email
 */
async function applyWhiteLabel(params: SendEmailParams): Promise<SendEmailParams> {
  // If no tenant ID, return as-is
  if (!params.tenantId) {
    return params;
  }
  
  try {
    // Load tenant white-label settings
    const whiteLabel = await getTenantWhiteLabel(params.tenantId);
    
    if (!whiteLabel) {
      return params;
    }
    
    // Apply custom domain if available
    let from = params.from;
    if (params.customDomain || whiteLabel.customDomain) {
      const domain = params.customDomain || whiteLabel.customDomain;
      if (typeof from === 'string') {
        from = from.replace(/@.+$/, `@${domain}`);
      } else {
        from = { ...from, email: from.email.replace(/@.+$/, `@${domain}`) };
      }
    }
    
    // Apply branding to HTML content (inject CSS variables)
    let html = params.html;
    if (whiteLabel.primaryColor || whiteLabel.secondaryColor) {
      const style = `
        <style>
          :root {
            --primary-color: ${whiteLabel.primaryColor || '#3b82f6'};
            --secondary-color: ${whiteLabel.secondaryColor || '#10b981'};
          }
        </style>
      `;
      html = style + html;
    }
    
    return {
      ...params,
      from,
      html,
    };
  } catch (error) {
    console.error('[Email Service] Failed to apply white-label:', error);
    return params;
  }
}

/**
 * Get tenant white-label settings
 */
async function getTenantWhiteLabel(tenantId: string): Promise<any> {
  try {
    // Import Supabase client
    const { createAdminClient } = await import('@/core/database/admin-client');
    const supabase = createAdminClient();
    
    const tenantResult: { data: { branding: any; theme_settings: any; custom_domains: any } | null; error: any } = await supabase
      .from('tenants')
      .select('branding, theme_settings, custom_domains')
      .eq('id', tenantId)
      .single();
    
    const data = tenantResult.data;
    if (tenantResult.error || !data) {
      console.warn(`[Email Service] Could not load tenant ${tenantId} white-label settings`);
      return null;
    }
    
    return {
      logo: data.branding?.logo,
      companyName: data.branding?.companyName,
      primaryColor: data.theme_settings?.primaryColor,
      secondaryColor: data.theme_settings?.secondaryColor,
      customDomain: data.custom_domains?.[0], // Use first custom domain
    };
  } catch (error) {
    console.error('[Email Service] Error loading white-label settings:', error);
    return null;
  }
}

/**
 * Log email send for audit/debugging
 */
async function logEmailSend(result: SendEmailResult, params: SendEmailParams): Promise<void> {
  try {
    // This could be expanded to write to a database table
    console.log('[Email Service] Email sent:', {
      messageId: result.messageId,
      provider: result.provider,
      to: params.to,
      subject: params.subject,
      timestamp: result.timestamp,
    });
    
    // Future: Write to email_logs table
    // const { createAdminClient } = await import('@/lib/supabase/admin-client');
    // const supabase = createAdminClient();
    // await supabase.from('email_logs').insert({ ... });
  } catch (error) {
    console.error('[Email Service] Failed to log email:', error);
  }
}

/**
 * Render React Email template to HTML
 */
async function renderTemplate<T>(
  TemplateComponent: React.ComponentType<T>,
  props: T,
  options?: { plainText?: boolean }
): Promise<string> {
  try {
    // Note: react-email render will be imported after npm install
    // For now, return a placeholder
    if (typeof require !== 'undefined') {
      try {
        const { render } = require('@react-email/render');
        const React = require('react');
        return await render(React.createElement(TemplateComponent, props), {
          pretty: false,
          plainText: options?.plainText,
        });
      } catch (error) {
        console.warn('[Email Service] React Email not installed. Run: npm install react-email @react-email/components');
        return '<p>Email content (install react-email to render templates)</p>';
      }
    }
    return '<p>Email content</p>';
  } catch (error) {
    console.error('[Email Service] Template render error:', error);
    throw error;
  }
}

/**
 * Utility: Sleep for given milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Health check for email system
 */
export async function checkEmailHealth(): Promise<{
  healthy: boolean;
  primary?: any;
  fallback?: any;
}> {
  const results: any = {
    healthy: false,
  };
  
  try {
    // Check primary provider
    const primaryConfig = getProviderConfigFromEnv();
    if (primaryConfig) {
      const primaryProvider = await providerRegistry.getOrCreate(primaryConfig);
      results.primary = await primaryProvider.healthCheck();
    }
    
    // Check fallback provider
    const fallbackConfig = getFallbackProviderConfig();
    if (fallbackConfig) {
      const fallbackProvider = await providerRegistry.getOrCreate(fallbackConfig);
      results.fallback = await fallbackProvider.healthCheck();
    }
    
    results.healthy = results.primary?.healthy || results.fallback?.healthy;
  } catch (error) {
    console.error('[Email Service] Health check failed:', error);
    results.error = error instanceof Error ? error.message : 'Unknown error';
  }
  
  return results;
}

