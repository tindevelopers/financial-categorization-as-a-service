/**
 * Email Provider Interface
 * 
 * This interface defines the contract that all email providers must implement.
 * It ensures consistency across different providers (Resend, SendGrid, Amazon SES, etc.)
 */

// Email provider types
export type EmailProviderType = 
  | 'resend' 
  | 'sendgrid' 
  | 'amazon_ses' 
  | 'brevo' 
  | 'gohighlevel' 
  | 'postmark' 
  | 'mailgun'
  | 'inbucket'; // Local testing only

// Email sending parameters
export interface SendEmailParams {
  // Recipients
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  
  // Sender
  from: string | { email: string; name: string };
  replyTo?: string;
  
  // Content
  subject: string;
  html: string;
  text?: string;
  
  // Metadata
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
  headers?: Record<string, string>;
  
  // Features
  attachments?: EmailAttachment[];
  trackOpens?: boolean;
  trackClicks?: boolean;
  
  // White-label context
  tenantId?: string;
  customDomain?: string;
}

// Email attachment
export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
  path?: string; // URL or file path
}

// Email send result
export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  provider: string;
  timestamp: Date;
  error?: EmailError;
  metadata?: Record<string, any>;
}

// Email error
export interface EmailError {
  code: string;
  message: string;
  statusCode?: number;
  details?: any;
}

// Provider configuration
export interface ProviderConfig {
  type: EmailProviderType;
  credentials: Record<string, any>;
  settings?: ProviderSettings;
}

// Provider settings
export interface ProviderSettings {
  defaultFrom?: string | { email: string; name: string };
  timeout?: number;
  retries?: number;
  rateLimit?: {
    maxPerSecond?: number;
    maxPerMinute?: number;
    maxPerHour?: number;
  };
  sandbox?: boolean; // For testing without actual sends
}

// Provider capabilities
export interface ProviderCapabilities {
  transactional: boolean;
  marketing: boolean;
  templates: boolean;
  bulkSend: boolean;
  scheduling: boolean;
  tracking: boolean;
  attachments: boolean;
  inlineImages: boolean;
  customHeaders: boolean;
}

// Health check result
export interface HealthCheckResult {
  healthy: boolean;
  provider: string;
  timestamp: Date;
  latency?: number;
  error?: string;
}

// Rate limit info
export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt?: Date;
}

// Webhook result
export interface WebhookResult {
  processed: boolean;
  eventType: string;
  messageId?: string;
  status?: string;
  error?: string;
}

// Template email parameters
export interface TemplateEmailParams extends Omit<SendEmailParams, 'html' | 'text'> {
  templateId: string;
  templateData: Record<string, any>;
}

/**
 * Email Provider Interface
 * 
 * All email providers must implement this interface to be used with the system.
 */
export interface EmailProvider {
  // Identity
  readonly name: string;
  readonly type: EmailProviderType;
  
  // Capabilities
  readonly capabilities: ProviderCapabilities;
  
  // Lifecycle
  initialize(config: ProviderConfig): Promise<void>;
  
  // Core methods
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>;
  sendBulkEmails(params: SendEmailParams[]): Promise<SendEmailResult[]>;
  
  // Optional methods
  sendTemplateEmail?(params: TemplateEmailParams): Promise<SendEmailResult>;
  scheduleEmail?(params: SendEmailParams, sendAt: Date): Promise<SendEmailResult>;
  cancelScheduledEmail?(emailId: string): Promise<boolean>;
  
  // Health & monitoring
  healthCheck(): Promise<HealthCheckResult>;
  getRateLimits?(): Promise<RateLimitInfo>;
  
  // Webhooks
  handleWebhook?(payload: any): Promise<WebhookResult>;
}

// Template component props (for React Email)
export interface EmailTemplateProps {
  // Common props all templates should support
  tenantId?: string;
  tenantName?: string;
  tenantLogo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  
  // Template-specific props will be added via intersection types
  [key: string]: any;
}




