import { google } from 'googleapis';

/**
 * Gmail Service
 * Handles Gmail API operations for receiving and processing emails
 */

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    parts?: Array<{
      mimeType: string;
      filename?: string;
      body: { attachmentId?: string; data?: string; size?: number };
      parts?: any[];
    }>;
    body?: {
      data?: string;
      size?: number;
    };
  };
}

export interface ParsedGmailEmail {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: Date;
  textBody?: string;
  htmlBody?: string;
  attachments: Array<{
    filename: string;
    mimeType: string;
    attachmentId: string;
    size: number;
  }>;
}

export class GmailService {
  private gmail: ReturnType<typeof google.gmail>;
  // Avoid direct dependency on `google-auth-library` in the portal package.
  // `googleapis` provides the runtime OAuth2 client, but its underlying type lives in google-auth-library.
  private auth: InstanceType<typeof google.auth.OAuth2>;

  constructor(accessToken: string, refreshToken?: string) {
    this.auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    this.auth.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    this.gmail = google.gmail({ version: 'v1', auth: this.auth });
  }

  /**
   * Set up Gmail watch for push notifications
   * This tells Gmail to send push notifications when new emails arrive
   */
  async watchGmail(topicName: string): Promise<{ historyId: string; expiration: string }> {
    const response = await this.gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX'], // Only watch INBOX
      },
    });

    return {
      historyId: response.data.historyId || '',
      expiration: response.data.expiration || '',
    };
  }

  /**
   * Stop watching Gmail
   */
  async stopWatch(): Promise<void> {
    await this.gmail.users.stop({
      userId: 'me',
    });
  }

  /**
   * Get message by ID
   */
  async getMessage(messageId: string): Promise<GmailMessage> {
    const response = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    return response.data as GmailMessage;
  }

  /**
   * List messages matching a query
   */
  async listMessages(query: string, maxResults: number = 10): Promise<string[]> {
    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    });

    return (response.data.messages || []).map(msg => msg.id || '');
  }

  /**
   * Get attachment by ID
   */
  async getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    const response = await this.gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    return Buffer.from(response.data.data || '', 'base64');
  }

  /**
   * Parse Gmail message into structured format
   */
  async parseMessage(message: GmailMessage): Promise<ParsedGmailEmail> {
    const headers = message.payload.headers || [];
    const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const from = getHeader('from');
    const to = getHeader('to');
    const subject = getHeader('subject');
    const date = new Date(parseInt(message.internalDate));

    // Extract body text
    let textBody: string | undefined;
    let htmlBody: string | undefined;

    const extractBody = (parts: any[]): void => {
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          textBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'multipart/alternative' && part.parts) {
          extractBody(part.parts);
        } else if (part.mimeType === 'multipart/mixed' && part.parts) {
          extractBody(part.parts);
        }
      }
    };

    if (message.payload.parts) {
      extractBody(message.payload.parts);
    } else if (message.payload.body?.data) {
      textBody = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    }

    // Extract attachments
    const attachments: Array<{ filename: string; mimeType: string; attachmentId: string; size: number }> = [];

    const extractAttachments = (parts: any[]): void => {
      for (const part of parts) {
        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            attachmentId: part.body.attachmentId,
            size: part.body.size || 0,
          });
        } else if (part.parts) {
          extractAttachments(part.parts);
        }
      }
    };

    if (message.payload.parts) {
      extractAttachments(message.payload.parts);
    }

    return {
      id: message.id,
      from,
      to,
      subject,
      date,
      textBody,
      htmlBody,
      attachments,
    };
  }

  /**
   * Get messages since a history ID (for incremental sync)
   */
  async getHistory(historyId: string): Promise<{ messages: string[]; newHistoryId: string }> {
    const response = await this.gmail.users.history.list({
      userId: 'me',
      startHistoryId: historyId,
    });

    const messageIds: string[] = [];
    for (const history of response.data.history || []) {
      if (history.messagesAdded) {
        for (const msgAdded of history.messagesAdded) {
          if (msgAdded.message?.id) {
            messageIds.push(msgAdded.message.id);
          }
        }
      }
    }

    return {
      messages: messageIds,
      newHistoryId: response.data.historyId || historyId,
    };
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
  }

  /**
   * Add label to message
   */
  async addLabel(messageId: string, labelId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: [labelId],
      },
    });
  }
}

