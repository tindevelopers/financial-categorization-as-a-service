/**
 * Resend Email Provider
 * 
 * Implementation of EmailProvider interface for Resend
 * Docs: https://resend.com/docs
 */

import {
  EmailProvider,
  EmailProviderType,
  ProviderConfig,
  ProviderCapabilities,
  SendEmailParams,
  SendEmailResult,
  HealthCheckResult,
  EmailError,
} from '../email-interface';

// Resend SDK will be imported after npm install
// import { Resend } from 'resend';

export class ResendProvider implements EmailProvider {
  readonly name = 'Resend';
  readonly type: EmailProviderType = 'resend';
  
  readonly capabilities: ProviderCapabilities = {
    transactional: true,
    marketing: false,
    templates: true,
    bulkSend: true,
    scheduling: false,
    tracking: true,
    attachments: true,
    inlineImages: true,
    customHeaders: true,
  };
  
  private client: any; // Will be Resend instance
  private config?: ProviderConfig;
  private defaultFrom?: string;
  
  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;
    this.defaultFrom = config.settings?.defaultFrom as string;
    
    // Note: Resend SDK will be imported after npm install
    // For now, we'll create a mock implementation
    if (typeof require !== 'undefined') {
      try {
        const { Resend } = require('resend');
        this.client = new Resend(config.credentials.apiKey);
      } catch (error) {
        console.warn('Resend SDK not installed. Run: npm install resend');
        // Create mock client for development
        this.client = this.createMockClient();
      }
    } else {
      this.client = this.createMockClient();
    }
  }
  
  private createMockClient() {
    return {
      emails: {
        send: async (params: any) => {
          console.log('[MOCK RESEND] Would send email:', {
            to: params.to,
            from: params.from,
            subject: params.subject,
          });
          return {
            id: `mock_${Date.now()}`,
            error: null,
          };
        },
        sendBatch: async (params: any[]) => {
          console.log(`[MOCK RESEND] Would send ${params.length} emails`);
          return params.map((_, i) => ({
            id: `mock_${Date.now()}_${i}`,
            error: null,
          }));
        },
      },
    };
  }
  
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    try {
      const from = this.getFromAddress(params.from);
      const attachments = this.formatAttachments(params.attachments);
      
      const result = await this.client.emails.send({
        from,
        to: Array.isArray(params.to) ? params.to : [params.to],
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        html: params.html,
        text: params.text,
        reply_to: params.replyTo,
        attachments,
        headers: params.headers,
        tags: params.tags ? Object.entries(params.tags).map(([name, value]) => ({ name, value })) : undefined,
      });
      
      if (result.error) {
        return this.createErrorResult(result.error);
      }
      
      return {
        success: true,
        messageId: result.id,
        provider: this.name,
        timestamp: new Date(),
        metadata: result,
      };
    } catch (error) {
      return this.createErrorResult(error);
    }
  }
  
  async sendBulkEmails(params: SendEmailParams[]): Promise<SendEmailResult[]> {
    try {
      const emailsData = params.map(email => ({
        from: this.getFromAddress(email.from),
        to: Array.isArray(email.to) ? email.to : [email.to],
        cc: email.cc,
        bcc: email.bcc,
        subject: email.subject,
        html: email.html,
        text: email.text,
        reply_to: email.replyTo,
        attachments: this.formatAttachments(email.attachments),
        headers: email.headers,
        tags: email.tags ? Object.entries(email.tags).map(([name, value]) => ({ name, value })) : undefined,
      }));
      
      const results = await this.client.emails.sendBatch(emailsData);
      
      return results.map((result: any) => {
        if (result.error) {
          return this.createErrorResult(result.error);
        }
        
        return {
          success: true,
          messageId: result.id,
          provider: this.name,
          timestamp: new Date(),
          metadata: result,
        };
      });
    } catch (error) {
      // If batch send fails entirely, return error for all
      const errorResult = this.createErrorResult(error);
      return params.map(() => errorResult);
    }
  }
  
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Resend doesn't have a dedicated health check endpoint
      // We'll just check if the client is initialized
      if (!this.client) {
        return {
          healthy: false,
          provider: this.name,
          timestamp: new Date(),
          error: 'Client not initialized',
        };
      }
      
      return {
        healthy: true,
        provider: this.name,
        timestamp: new Date(),
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        provider: this.name,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  private getFromAddress(from: string | { email: string; name: string }): string {
    if (typeof from === 'string') {
      return from;
    }
    
    if (from.name) {
      return `${from.name} <${from.email}>`;
    }
    
    return from.email;
  }
  
  private formatAttachments(attachments?: any[]): any[] | undefined {
    if (!attachments || attachments.length === 0) {
      return undefined;
    }
    
    return attachments.map(att => ({
      filename: att.filename,
      content: att.content,
      content_type: att.contentType,
      path: att.path,
    }));
  }
  
  private createErrorResult(error: any): SendEmailResult {
    const emailError: EmailError = {
      code: error.statusCode?.toString() || error.code || 'UNKNOWN',
      message: error.message || 'Failed to send email',
      statusCode: error.statusCode,
      details: error,
    };
    
    return {
      success: false,
      provider: this.name,
      timestamp: new Date(),
      error: emailError,
    };
  }
}




