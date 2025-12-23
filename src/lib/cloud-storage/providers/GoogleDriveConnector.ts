import { CloudStorageProvider, CloudFile } from '../CloudStorageManager';
import { google } from 'googleapis';

/**
 * Google Drive Connector
 * Handles OAuth and file operations for Google Drive
 */

export class GoogleDriveConnector implements CloudStorageProvider {
  provider: 'google_drive' = 'google_drive';
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Google Drive credentials not configured');
    }
  }

  getAuthorizationUrl(redirectUri: string, state?: string): string {
    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      redirectUri
    );

    const scopes = [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state || '',
      prompt: 'consent', // Force consent to get refresh token
    });
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : undefined;

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt?: Date;
  }> {
    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token');
    }

    const expiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : undefined;

    return {
      accessToken: credentials.access_token,
      expiresAt,
    };
  }

  async listFiles(folderId: string, accessToken: string): Promise<CloudFile[]> {
    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret
    );
    oauth2Client.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Query for PDF and image files only
    const query = `'${folderId}' in parents and (mimeType='application/pdf' or mimeType contains 'image/') and trashed=false`;

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, size, modifiedTime, md5Checksum)',
      pageSize: 1000,
    });

    const files = response.data.files || [];

    return files.map(file => ({
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      size: parseInt(file.size || '0'),
      modifiedAt: new Date(file.modifiedTime!),
      hash: file.md5Checksum,
    }));
  }

  async downloadFile(fileId: string, accessToken: string): Promise<Buffer> {
    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret
    );
    oauth2Client.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const response = await drive.files.get(
      {
        fileId,
        alt: 'media',
      },
      { responseType: 'arraybuffer' }
    );

    return Buffer.from(response.data as ArrayBuffer);
  }

  async getFolderInfo(folderId: string, accessToken: string): Promise<{
    id: string;
    name: string;
    path?: string;
  }> {
    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret
    );
    oauth2Client.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, parents',
    });

    const folder = response.data;

    // Build path (simplified - just folder name for now)
    let path = folder.name || '';

    return {
      id: folder.id!,
      name: folder.name!,
      path,
    };
  }

  async setupWebhook(
    folderId: string,
    accessToken: string,
    webhookUrl: string
  ): Promise<{
    webhookId: string;
    webhookUrl: string;
  }> {
    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret
    );
    oauth2Client.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Setup Google Drive push notification
    const response = await drive.files.watch({
      fileId: folderId,
      requestBody: {
        id: `channel-${folderId}-${Date.now()}`,
        type: 'web_hook',
        address: webhookUrl,
      },
    });

    return {
      webhookId: response.data.id!,
      webhookUrl: response.data.address!,
    };
  }

  async removeWebhook(webhookId: string, accessToken: string): Promise<void> {
    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret
    );
    oauth2Client.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Stop watching
    await drive.channels.stop({
      requestBody: {
        id: webhookId,
        resourceId: webhookId,
      },
    });
  }
}

