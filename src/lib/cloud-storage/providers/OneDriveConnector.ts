import { CloudStorageProvider, CloudFile } from '../CloudStorageManager';
import { Client } from '@microsoft/microsoft-graph-client';

/**
 * OneDrive Connector
 * Handles OAuth and file operations for Microsoft OneDrive
 */

export class OneDriveConnector implements CloudStorageProvider {
  provider: 'onedrive' = 'onedrive';
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.ONEDRIVE_CLIENT_ID || '';
    this.clientSecret = process.env.ONEDRIVE_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      throw new Error('OneDrive credentials not configured');
    }
  }

  getAuthorizationUrl(redirectUri: string, state?: string): string {
    const scopes = ['files.read', 'offline_access'].join(' ');
    
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${this.clientId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_mode=query` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&state=${state || ''}`;
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange code: ${response.statusText}`);
    }

    const data = await response.json();

    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt?: Date;
  }> {
    const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    const data = await response.json();

    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    return {
      accessToken: data.access_token,
      expiresAt,
    };
  }

  async listFiles(folderId: string, accessToken: string): Promise<CloudFile[]> {
    const client = Client.init({
      authProvider: done => done(null, accessToken),
    });

    const response = await client
      .api(`/me/drive/items/${folderId}/children`)
      .select('id,name,size,lastModifiedDateTime,file')
      .get();

    // Filter for PDFs and images
    const files = response.value.filter(
      (item: any) =>
        item.file &&
        (item.name.endsWith('.pdf') ||
          item.name.match(/\.(jpg|jpeg|png|gif|webp)$/i))
    );

    return files.map((file: any) => ({
      id: file.id,
      name: file.name,
      mimeType: file.name.endsWith('.pdf')
        ? 'application/pdf'
        : file.file.mimeType || 'image/jpeg',
      size: file.size,
      modifiedAt: new Date(file.lastModifiedDateTime),
      hash: file.file.hashes?.sha1Hash,
    }));
  }

  async downloadFile(fileId: string, accessToken: string): Promise<Buffer> {
    const client = Client.init({
      authProvider: done => done(null, accessToken),
    });

    const stream = await client
      .api(`/me/drive/items/${fileId}/content`)
      .getStream();

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  async getFolderInfo(folderId: string, accessToken: string): Promise<{
    id: string;
    name: string;
    path?: string;
  }> {
    const client = Client.init({
      authProvider: done => done(null, accessToken),
    });

    const folder = await client
      .api(`/me/drive/items/${folderId}`)
      .select('id,name,parentReference')
      .get();

    return {
      id: folder.id,
      name: folder.name,
      path: folder.parentReference?.path || '',
    };
  }
}

