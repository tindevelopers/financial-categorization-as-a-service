import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';
import { GmailService } from '@/lib/email/GmailService';
import { nanoid } from 'nanoid';

/**
 * Gmail Push Notification Webhook
 * Receives push notifications from Gmail when new emails arrive
 * Processes emails and creates financial documents
 */

interface GmailPushNotification {
  message: {
    data: string; // Base64 encoded JSON
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const db = supabase as any;

    // Verify webhook signature (Gmail Pub/Sub)
    const signature = request.headers.get('x-goog-signature');
    const timestamp = request.headers.get('x-goog-timestamp');
    
    // TODO: Implement signature verification for Gmail Pub/Sub
    // For now, we'll rely on HTTPS and topic authentication

    // Parse Pub/Sub message
    const body: GmailPushNotification = await request.json();
    
    if (!body.message?.data) {
      return NextResponse.json(
        { error: 'Invalid message format' },
        { status: 400 }
      );
    }

    // Decode base64 message data
    const messageData = JSON.parse(
      Buffer.from(body.message.data, 'base64').toString('utf-8')
    );

    const emailAddress = messageData.emailAddress;
    const historyId = messageData.historyId;

    if (!emailAddress || !historyId) {
      return NextResponse.json(
        { error: 'Missing emailAddress or historyId' },
        { status: 400 }
      );
    }

    // Find forwarding address
    const { data: forwardingAddress, error: lookupError } = await db
      .from('email_forwarding_addresses')
      .select('id, tenant_id, user_id, is_active')
      .eq('email_address', emailAddress.toLowerCase())
      .eq('is_active', true)
      .single();

    if (lookupError || !forwardingAddress) {
      console.error('Forwarding address not found:', emailAddress);
      return NextResponse.json(
        { error: 'Email address not found or inactive' },
        { status: 404 }
      );
    }

    const tenantId = forwardingAddress.tenant_id;
    const userId = forwardingAddress.user_id;

    // Get Gmail OAuth tokens for this tenant/user
    // In a real implementation, you'd store Gmail OAuth tokens per tenant/user
    // For now, we'll use a service account or shared Gmail account
    const gmailAccessToken = process.env.GMAIL_ACCESS_TOKEN; // Service account token
    const gmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!gmailAccessToken) {
      console.error('Gmail access token not configured');
      return NextResponse.json(
        { error: 'Gmail service not configured' },
        { status: 500 }
      );
    }

    // Initialize Gmail service
    const gmailService = new GmailService(gmailAccessToken, gmailRefreshToken);

    // Get new messages since historyId
    const { messages: newMessageIds, newHistoryId } = await gmailService.getHistory(historyId);

    if (newMessageIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new messages',
      });
    }

    // Process each new message
    const documentsCreated: string[] = [];
    const errors: string[] = [];

    for (const messageId of newMessageIds) {
      try {
        // Get full message
        const gmailMessage = await gmailService.getMessage(messageId);
        const parsedEmail = await gmailService.parseMessage(gmailMessage);

        // Filter messages to this forwarding address
        if (!parsedEmail.to.toLowerCase().includes(emailAddress.toLowerCase())) {
          continue;
        }

        // Create email receipt record
        const { data: emailReceipt, error: receiptError } = await db
          .from('email_receipts')
          .insert({
            tenant_id: tenantId,
            user_id: userId,
            forwarding_address_id: forwardingAddress.id,
            from_address: parsedEmail.from,
            to_address: parsedEmail.to,
            subject: parsedEmail.subject,
            processing_status: 'processing',
            attachments_count: parsedEmail.attachments.length,
            raw_email_json: {
              gmailMessageId: messageId,
              from: parsedEmail.from,
              to: parsedEmail.to,
              subject: parsedEmail.subject,
              snippet: gmailMessage.snippet,
            },
          })
          .select('id')
          .single();

        if (receiptError || !emailReceipt) {
          console.error('Error creating email receipt:', receiptError);
          errors.push(`Failed to create receipt for message ${messageId}`);
          continue;
        }

        // Process attachments
        for (const attachment of parsedEmail.attachments) {
          try {
            // Only process PDFs and images
            if (!isValidFileType(attachment.mimeType)) {
              continue;
            }

            // Download attachment
            const attachmentBuffer = await gmailService.getAttachment(messageId, attachment.attachmentId);

            // Upload to Supabase Storage
            const fileExtension = getFileExtension(attachment.filename);
            const storagePath = `${tenantId}/${userId}/email-receipts/${nanoid()}.${fileExtension}`;

            const { error: uploadError } = await supabase.storage
              .from('financial-documents')
              .upload(storagePath, attachmentBuffer, {
                contentType: attachment.mimeType,
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
                tenant_id: tenantId,
                user_id: userId,
                original_filename: attachment.filename,
                file_type: getFileTypeFromMime(attachment.mimeType),
                mime_type: attachment.mimeType,
                file_size_bytes: attachment.size,
                supabase_path: storagePath,
                storage_tier: 'hot',
                ocr_status: 'pending',
                reconciliation_status: 'unreconciled',
                description: `Received via email: ${parsedEmail.subject}`,
              })
              .select('id')
              .single();

            if (docError || !document) {
              console.error('Document creation error:', docError);
              errors.push(`Failed to create document for ${attachment.filename}`);
              continue;
            }

            documentsCreated.push(document.id);

            // Trigger OCR processing asynchronously
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
              (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3002');
            fetch(`${appUrl}/api/documents/${document.id}/process-ocr`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
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

        // Update forwarding address stats
        await db
          .from('email_forwarding_addresses')
          .update({
            emails_received: (forwardingAddress.emails_received || 0) + 1,
            last_email_at: new Date().toISOString(),
          })
          .eq('id', forwardingAddress.id);

        // Mark message as read in Gmail
        await gmailService.markAsRead(messageId);

      } catch (error) {
        console.error('Message processing error:', error);
        errors.push(`Failed to process message ${messageId}`);
      }
    }

    return NextResponse.json({
      success: true,
      messages_processed: newMessageIds.length,
      documents_created: documentsCreated.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Gmail webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions
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

function getFileTypeFromMime(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'receipt';
  if (mimeType.includes('image')) return 'receipt';
  return 'other';
}

