import { createClient } from '@/core/database/server';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

/**
 * Email Forwarding Service
 * Manages email forwarding addresses and parsing utilities
 */

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  size: number;
}

export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  textBody?: string;
  htmlBody?: string;
  attachments: EmailAttachment[];
  receivedAt: Date;
}

export class EmailForwardingService {
  private readonly emailDomain: string;
  private readonly webhookSecret: string;

  constructor() {
    this.emailDomain = process.env.EMAIL_FORWARDING_DOMAIN || 'receipts.yourdomain.com';
    this.webhookSecret = process.env.EMAIL_WEBHOOK_SECRET || '';
  }

  /**
   * Generate a unique email address for a user
   */
  async generateForwardingAddress(userId: string): Promise<string> {
    const supabase = await createClient();

    // Check if user already has an active address
    const { data: existing } = await (supabase as any)
      .from('email_forwarding_addresses')
      .select('email_address')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (existing) {
      return existing.email_address;
    }

    // Generate new unique address
    const uniqueId = nanoid(12);
    const emailAddress = `receipts-${uniqueId}@${this.emailDomain}`;

    // Create in database
    const { data, error } = await (supabase as any)
      .from('email_forwarding_addresses')
      .insert({
        user_id: userId,
        email_address: emailAddress,
        is_active: true,
      })
      .select('email_address')
      .single();

    if (error) {
      throw new Error(`Failed to create forwarding address: ${error.message}`);
    }

    return data.email_address;
  }

  /**
   * Verify webhook signature (SendGrid)
   */
  verifySendGridSignature(
    payload: string,
    signature: string | null,
    timestamp: string | null
  ): boolean {
    if (!signature || !timestamp || !this.webhookSecret) {
      return false;
    }

    try {
      // SendGrid signature format: t=timestamp,v1=signature
      const signatureParts = signature.split(',');
      const timestampPart = signatureParts.find(p => p.startsWith('t='));
      const signaturePart = signatureParts.find(p => p.startsWith('v1='));

      if (!timestampPart || !signaturePart) {
        return false;
      }

      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(timestamp + payload)
        .digest('hex');

      const receivedSignature = signaturePart.split('=')[1];

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(receivedSignature)
      );
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Verify webhook signature (CloudMailin)
   */
  verifyCloudMailinSignature(payload: string, signature: string | null): boolean {
    if (!signature || !this.webhookSecret) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      );
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Extract user ID from email address
   */
  extractUserIdFromEmail(emailAddress: string): string | null {
    const match = emailAddress.toLowerCase().match(/receipts-([a-z0-9_-]+)@/i);
    return match ? match[1] : null;
  }

  /**
   * Validate email address format
   */
  isValidForwardingAddress(emailAddress: string): boolean {
    const regex = new RegExp(`receipts-[a-z0-9_-]+@${this.emailDomain.replace('.', '\\.')}`, 'i');
    return regex.test(emailAddress.toLowerCase());
  }

  /**
   * Get user ID from forwarding address
   */
  async getUserIdFromForwardingAddress(emailAddress: string): Promise<string | null> {
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from('email_forwarding_addresses')
      .select('user_id, is_active')
      .eq('email_address', emailAddress.toLowerCase())
      .single();

    if (error || !data || !data.is_active) {
      return null;
    }

    return data.user_id;
  }

  /**
   * Log email receipt
   */
  async logEmailReceipt(
    userId: string,
    forwardingAddressId: string,
    message: EmailMessage,
    status: 'pending' | 'processing' | 'completed' | 'failed' = 'pending'
  ): Promise<string> {
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from('email_receipts')
      .insert({
        user_id: userId,
        forwarding_address_id: forwardingAddressId,
        from_address: message.from,
        to_address: message.to,
        subject: message.subject,
        received_at: message.receivedAt.toISOString(),
        processing_status: status,
        attachments_count: message.attachments.length,
        raw_email_json: {
          from: message.from,
          to: message.to,
          subject: message.subject,
          textBody: message.textBody?.substring(0, 1000),
        },
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to log email receipt: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Update email receipt status
   */
  async updateEmailReceiptStatus(
    receiptId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    documentsCreated?: string[],
    error?: string
  ): Promise<void> {
    const supabase = await createClient();

    const updateData: any = {
      processing_status: status,
    };

    if (documentsCreated) {
      updateData.documents_created = documentsCreated;
    }

    if (error) {
      updateData.processing_error = error;
    }

    const { error: updateError } = await (supabase as any)
      .from('email_receipts')
      .update(updateData)
      .eq('id', receiptId);

    if (updateError) {
      console.error('Failed to update email receipt:', updateError);
    }
  }

  /**
   * Update forwarding address statistics
   */
  async updateForwardingAddressStats(forwardingAddressId: string): Promise<void> {
    const supabase = await createClient();

    const { data: address } = await (supabase as any)
      .from('email_forwarding_addresses')
      .select('emails_received')
      .eq('id', forwardingAddressId)
      .single();

    if (address) {
      await (supabase as any)
        .from('email_forwarding_addresses')
        .update({
          emails_received: (address.emails_received || 0) + 1,
          last_email_at: new Date().toISOString(),
        })
        .eq('id', forwardingAddressId);
    }
  }

  /**
   * Extract attachments from FormData (SendGrid format)
   */
  async extractSendGridAttachments(formData: FormData): Promise<EmailAttachment[]> {
    const attachments: EmailAttachment[] = [];
    const attachmentCount = parseInt(formData.get('attachments') as string || '0');

    for (let i = 1; i <= attachmentCount; i++) {
      const file = formData.get(`attachment${i}`) as File;
      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer());
        attachments.push({
          filename: file.name,
          content: buffer,
          contentType: file.type,
          size: file.size,
        });
      }
    }

    return attachments;
  }

  /**
   * Extract attachments from JSON (CloudMailin format)
   */
  extractCloudMailinAttachments(emailData: any): EmailAttachment[] {
    const attachments: EmailAttachment[] = [];

    if (emailData.attachments) {
      for (const att of emailData.attachments) {
        const content = att.content
          ? Buffer.from(att.content, 'base64')
          : Buffer.alloc(0);

        attachments.push({
          filename: att.file_name || att.filename || 'unknown',
          content,
          contentType: att.content_type || 'application/octet-stream',
          size: content.length,
        });
      }
    }

    return attachments;
  }

  /**
   * Filter document attachments (PDFs, images)
   */
  filterDocumentAttachments(attachments: EmailAttachment[]): EmailAttachment[] {
    const validMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/heic',
      'image/heif',
    ];

    return attachments.filter(att =>
      validMimeTypes.some(type => att.contentType.toLowerCase().includes(type))
    );
  }

  /**
   * Get email statistics for a user
   */
  async getEmailStatistics(userId: string, days: number = 30): Promise<{
    total: number;
    completed: number;
    failed: number;
    pending: number;
    documentsCreated: number;
  }> {
    const supabase = await createClient();

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const { data: receipts } = await (supabase as any)
      .from('email_receipts')
      .select('processing_status, documents_created')
      .eq('user_id', userId)
      .gte('received_at', sinceDate.toISOString());

    const stats = {
      total: receipts?.length || 0,
      completed: receipts?.filter((r: any) => r.processing_status === 'completed').length || 0,
      failed: receipts?.filter((r: any) => r.processing_status === 'failed').length || 0,
      pending: receipts?.filter((r: any) => r.processing_status === 'pending' || r.processing_status === 'processing').length || 0,
      documentsCreated: 0,
    };

    // Count total documents created
    receipts?.forEach((r: any) => {
      if (r.documents_created) {
        stats.documentsCreated += r.documents_created.length;
      }
    });

    return stats;
  }

  /**
   * Send confirmation email to user (placeholder)
   */
  async sendConfirmationEmail(
    userEmail: string,
    documentsCreated: number,
    subject: string
  ): Promise<void> {
    // TODO: Implement email sending using SendGrid, AWS SES, or similar
    console.log(`Confirmation email: ${documentsCreated} documents processed from "${subject}"`);
  }
}

// Singleton instance
let emailService: EmailForwardingService | null = null;

export function getEmailForwardingService(): EmailForwardingService {
  if (!emailService) {
    emailService = new EmailForwardingService();
  }
  return emailService;
}

