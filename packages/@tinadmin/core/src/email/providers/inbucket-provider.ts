/**
 * Inbucket Email Provider (Local Testing Only)
 * 
 * Implementation of EmailProvider interface for Inbucket
 * Inbucket is a local email testing server that comes with Supabase
 * Access it at: http://127.0.0.1:54324
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

export class InbucketProvider implements EmailProvider {
  readonly name = 'Inbucket (Local Testing)';
  readonly type: EmailProviderType = 'inbucket';
  
  readonly capabilities: ProviderCapabilities = {
    transactional: true,
    marketing: false,
    templates: false,
    bulkSend: true,
    scheduling: false,
    tracking: false,
    attachments: true,
    inlineImages: true,
    customHeaders: true,
  };
  
  private config?: ProviderConfig;
  private smtpHost: string = 'localhost';
  private smtpPort: number = 2500;
  private defaultFrom?: string;
  
  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;
    this.defaultFrom = config.settings?.defaultFrom as string;
    
    // Parse Inbucket URL to get SMTP host/port
    const url = config.credentials.url || 'http://127.0.0.1:54324';
    const urlObj = new URL(url);
    this.smtpHost = urlObj.hostname;
    // Inbucket SMTP port is typically 2500
    this.smtpPort = 2500;
  }
  
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    try {
      // For Inbucket, we'll use nodemailer with SMTP
      // This requires nodemailer to be installed
      let nodemailer: any;
      
      try {
        nodemailer = require('nodemailer');
      } catch (error) {
        // If nodemailer is not installed, just log the email
        console.log('[INBUCKET] Nodemailer not installed. Would send email:', {
          to: params.to,
          from: params.from,
          subject: params.subject,
        });
        console.log('[INBUCKET] Install nodemailer to actually send to Inbucket: npm install nodemailer');
        console.log(`[INBUCKET] View emails at: http://127.0.0.1:54324`);
        
        return {
          success: true,
          messageId: `inbucket_mock_${Date.now()}`,
          provider: this.name,
          timestamp: new Date(),
          metadata: {
            note: 'Email logged to console. Install nodemailer to send to Inbucket.',
          },
        };
      }
      
      // Create transporter
      const transporter = nodemailer.createTransport({
        host: this.smtpHost,
        port: this.smtpPort,
        secure: false, // Inbucket doesn't use TLS
        tls: {
          rejectUnauthorized: false,
        },
      });
      
      const from = this.getFromAddress(params.from);
      
      // Send email
      const info = await transporter.sendMail({
        from,
        to: Array.isArray(params.to) ? params.to.join(', ') : params.to,
        cc: params.cc ? (Array.isArray(params.cc) ? params.cc.join(', ') : params.cc) : undefined,
        bcc: params.bcc ? (Array.isArray(params.bcc) ? params.bcc.join(', ') : params.bcc) : undefined,
        subject: params.subject,
        html: params.html,
        text: params.text,
        replyTo: params.replyTo,
        attachments: params.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
          path: att.path,
        })),
        headers: params.headers,
      });
      
      console.log(`[INBUCKET] Email sent! View at: http://127.0.0.1:54324`);
      
      return {
        success: true,
        messageId: info.messageId,
        provider: this.name,
        timestamp: new Date(),
        metadata: {
          ...info,
          viewUrl: 'http://127.0.0.1:54324',
        },
      };
    } catch (error) {
      return this.createErrorResult(error);
    }
  }
  
  async sendBulkEmails(params: SendEmailParams[]): Promise<SendEmailResult[]> {
    // Send emails sequentially (could be parallelized)
    const results: SendEmailResult[] = [];
    
    for (const email of params) {
      const result = await this.sendEmail(email);
      results.push(result);
    }
    
    return results;
  }
  
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Try to connect to Inbucket SMTP
      const net = require('net');
      
      return await new Promise((resolve) => {
        const socket = net.createConnection({
          host: this.smtpHost,
          port: this.smtpPort,
          timeout: 5000,
        });
        
        socket.on('connect', () => {
          socket.end();
          resolve({
            healthy: true,
            provider: this.name,
            timestamp: new Date(),
            latency: Date.now() - startTime,
          });
        });
        
        socket.on('error', (error: Error) => {
          resolve({
            healthy: false,
            provider: this.name,
            timestamp: new Date(),
            error: `Cannot connect to Inbucket SMTP: ${error.message}. Is Supabase running?`,
          });
        });
        
        socket.on('timeout', () => {
          socket.destroy();
          resolve({
            healthy: false,
            provider: this.name,
            timestamp: new Date(),
            error: 'Connection timeout. Is Supabase running?',
          });
        });
      });
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
      return `"${from.name}" <${from.email}>`;
    }
    
    return from.email;
  }
  
  private createErrorResult(error: any): SendEmailResult {
    const emailError: EmailError = {
      code: error.code || 'INBUCKET_ERROR',
      message: error.message || 'Failed to send email to Inbucket',
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




