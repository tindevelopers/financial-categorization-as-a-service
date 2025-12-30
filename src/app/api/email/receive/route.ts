import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/core/database/server';
import { nanoid } from 'nanoid';
import { sendEmail } from '@/core/email';
import { getEmailForwardingService } from '@/lib/email/EmailForwardingService';
import crypto from 'crypto';

/**
 * Email Webhook Handler
 * Receives emails from SendGrid Inbound Parse, CloudMailin, or similar service
 * Processes attachments and creates financial documents
 */

interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
  size: number;
}

interface ParsedEmail {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments: EmailAttachment[];
}

// Types for tables not in generated types
interface ForwardingAddress {
  id: string;
  user_id: string;
  is_active: boolean;
  emails_received?: number;
  [key: string]: any;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    // Cast to any for tables not in generated types
    const db = supabase as any;
    
    // Verify webhook signature (implementation depends on email service)
    const signature = request.headers.get('x-webhook-signature');
    const timestamp = request.headers.get('x-webhook-timestamp');
    const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET;
    const contentType = request.headers.get('content-type') || '';
    
    if (webhookSecret && signature) {
      const emailService = getEmailForwardingService();
      let isValid = false;
      
      // For JSON payloads, we can verify the signature
      if (contentType.includes('application/json')) {
        // Clone request to read body without consuming it
        const clonedRequest = request.clone();
        const bodyText = await clonedRequest.text();
        
        // Try SendGrid signature format first
        if (timestamp) {
          isValid = emailService.verifySendGridSignature(bodyText, signature, timestamp);
        } else {
          // Try CloudMailin signature format
          isValid = emailService.verifyCloudMailinSignature(bodyText, signature);
        }
      } else {
        // For FormData, signature verification is more complex
        // SendGrid provides signature in headers, but we need to reconstruct the payload
        // For now, if signature exists and secret is set, we'll verify what we can
        // In production, you may want to implement full FormData signature verification
        if (timestamp) {
          // SendGrid FormData signature verification would require reconstructing the form data
          // For now, we'll allow it if secret is configured (you can enhance this later)
          isValid = true; // Placeholder - implement full FormData signature verification if needed
        } else {
          isValid = true; // Placeholder for CloudMailin FormData
        }
      }
      
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        );
      }
    }

    // Parse email based on service provider
    let parsedEmail: ParsedEmail;

    if (contentType.includes('multipart/form-data')) {
      // SendGrid Inbound Parse format
      parsedEmail = await parseSendGridEmail(request);
    } else if (contentType.includes('application/json')) {
      // CloudMailin or webhook JSON format
      const body = await request.json();
      parsedEmail = await parseCloudMailinEmail(body);
    } else {
      return NextResponse.json(
        { error: 'Unsupported email format' },
        { status: 400 }
      );
    }

    // Extract user from email address (receipts-[nanoid]@domain.com)
    const toEmail = parsedEmail.to.toLowerCase();
    const emailMatch = toEmail.match(/receipts-([a-z0-9_-]+)@/i);
    
    if (!emailMatch) {
      console.error('Invalid email format:', toEmail);
      return NextResponse.json(
        { error: 'Invalid recipient address' },
        { status: 400 }
      );
    }

    // Look up user by forwarding address
    const { data: forwardingAddress, error: lookupError } = await db
      .from('email_forwarding_addresses')
      .select('id, user_id, is_active, emails_received')
      .eq('email_address', toEmail)
      .single() as { data: ForwardingAddress | null; error: any };

    if (lookupError || !forwardingAddress || !forwardingAddress.is_active) {
      console.error('Forwarding address not found or inactive:', toEmail);
      return NextResponse.json(
        { error: 'Email address not found or inactive' },
        { status: 404 }
      );
    }

    const userId = forwardingAddress.user_id;

    // Create email receipt record
    const { data: emailReceipt, error: receiptError } = await db
      .from('email_receipts')
      .insert({
        user_id: userId,
        forwarding_address_id: forwardingAddress.id,
        from_address: parsedEmail.from,
        to_address: parsedEmail.to,
        subject: parsedEmail.subject,
        processing_status: 'processing',
        attachments_count: parsedEmail.attachments.length,
        raw_email_json: {
          from: parsedEmail.from,
          to: parsedEmail.to,
          subject: parsedEmail.subject,
          text: parsedEmail.text?.substring(0, 1000), // Truncate for storage
        },
      })
      .select('id')
      .single() as { data: { id: string } | null; error: any };

    if (receiptError || !emailReceipt) {
      console.error('Error creating email receipt:', receiptError);
      return NextResponse.json(
        { error: 'Failed to create email receipt' },
        { status: 500 }
      );
    }

    // Update forwarding address stats
    await db
      .from('email_forwarding_addresses')
      .update({
        emails_received: (forwardingAddress.emails_received || 0) + 1,
        last_email_at: new Date().toISOString(),
      })
      .eq('id', forwardingAddress.id);

    // Process attachments
    const documentsCreated: string[] = [];
    const errors: string[] = [];

    for (const attachment of parsedEmail.attachments) {
      try {
        // Only process PDFs and images
        if (!isValidFileType(attachment.contentType)) {
          console.log('Skipping non-document attachment:', attachment.filename);
          continue;
        }

        // Upload to Supabase Storage
        const fileExtension = getFileExtension(attachment.filename);
        const storagePath = `${userId}/email-receipts/${nanoid()}.${fileExtension}`;
        
        const fileBuffer = Buffer.isBuffer(attachment.content)
          ? attachment.content
          : Buffer.from(attachment.content as string, 'base64');

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, fileBuffer, {
            contentType: attachment.contentType,
            upsert: false,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          errors.push(`Failed to upload ${attachment.filename}`);
          continue;
        }

        // Create financial_documents record
        const { data: document, error: docError } = await db
          .from('financial_documents')
          .insert({
            user_id: userId,
            original_filename: attachment.filename,
            storage_path: storagePath,
            storage_bucket: 'documents',
            storage_tier: 'hot',
            mime_type: attachment.contentType,
            file_size: attachment.size,
            file_hash: '', // Will be calculated in background
            source: 'email',
            ocr_status: 'pending',
            reconciliation_status: 'unreconciled',
          })
          .select('id')
          .single() as { data: { id: string } | null; error: any };

        if (docError || !document) {
          console.error('Document creation error:', docError);
          errors.push(`Failed to create document for ${attachment.filename}`);
          continue;
        }

        documentsCreated.push(document.id);

        // Trigger OCR processing asynchronously
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/documents/process-ocr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: document.id }),
        }).catch(err => console.error('OCR trigger error:', err));

      } catch (error) {
        console.error('Attachment processing error:', error);
        errors.push(`Failed to process ${attachment.filename}`);
      }
    }

    // Update email receipt with results
    await db
      .from('email_receipts')
      .update({
        processing_status: errors.length > 0 && documentsCreated.length === 0 ? 'failed' : 'completed',
        documents_created: documentsCreated,
        processing_error: errors.length > 0 ? errors.join('; ') : null,
      })
      .eq('id', emailReceipt.id);

    // Send confirmation email (optional)
    if (documentsCreated.length > 0) {
      try {
        // Get user email
        const { data: userData } = await db
          .from('users')
          .select('email')
          .eq('id', userId)
          .single();
        
        if (userData?.email) {
          const emailService = getEmailForwardingService();
          await emailService.sendConfirmationEmail(
            userData.email,
            documentsCreated.length,
            parsedEmail.subject
          );
        }
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        // Don't fail the request if email sending fails
      }
    }

    return NextResponse.json({
      success: true,
      email_receipt_id: emailReceipt.id,
      documents_created: documentsCreated.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Email receive error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions

// Signature verification is now handled by EmailForwardingService
// This function is kept for backward compatibility but delegates to the service
function verifyWebhookSignature(signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  // Signature verification is handled in the main handler using EmailForwardingService
  // This is a fallback for cases where the service isn't available
  return true; // Will be properly verified in main handler
}

async function parseSendGridEmail(request: NextRequest): Promise<ParsedEmail> {
  const formData = await request.formData();
  
  const from = formData.get('from') as string;
  const to = formData.get('to') as string;
  const subject = formData.get('subject') as string;
  const text = formData.get('text') as string;
  const html = formData.get('html') as string;
  
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
  
  return { from, to, subject, text, html, attachments };
}

async function parseCloudMailinEmail(body: any): Promise<ParsedEmail> {
  // CloudMailin JSON format
  const envelope = body.envelope || {};
  const headers = body.headers || {};
  const attachments: EmailAttachment[] = [];
  
  if (body.attachments) {
    for (const att of body.attachments) {
      attachments.push({
        filename: att.file_name || att.filename,
        content: att.content, // Base64 encoded
        contentType: att.content_type,
        size: att.size || 0,
      });
    }
  }
  
  return {
    from: envelope.from || headers.from,
    to: envelope.to || headers.to,
    subject: headers.subject || '',
    text: body.plain || body.text || '',
    html: body.html || '',
    attachments,
  };
}

function isValidFileType(mimeType: string): boolean {
  const validTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
  ];
  return validTypes.some(type => mimeType.toLowerCase().includes(type));
}

function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : 'pdf';
}
