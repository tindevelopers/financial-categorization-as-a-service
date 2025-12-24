import { CloudStorageProvider, CloudFile } from '../CloudStorageManager';
import { Dropbox } from 'dropbox';

/**
 * Dropbox Connector
 * Handles OAuth and file operations for Dropbox
 */

export class DropboxConnector implements CloudStorageProvider {
  provider: 'dropbox' = 'dropbox';
  private appKey: string;
  private appSecret: string;

  constructor() {
    this.appKey = process.env.DROPBOX_APP_KEY || '';
    this.appSecret = process.env.DROPBOX_APP_SECRET || '';

    if (!this.appKey || !this.appSecret) {
      throw new Error('Dropbox credentials not configured');
    }
  }

  getAuthorizationUrl(redirectUri: string, state?: string): string {
    const dbx = new Dropbox({
      clientId: this.appKey,
      clientSecret: this.appSecret,
    });

    return dbx.auth.getAuthenticationUrl(
      redirectUri,
      state,
      'code',
      'offline',
      undefined,
      undefined,
      true
    );
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    const dbx = new Dropbox({
      clientId: this.appKey,
      clientSecret: this.appSecret,
    });

    const response = await dbx.auth.getAccessTokenFromCode(redirectUri, code);

    const result = response.result as any;

    const expiresAt = result.expires_in
      ? new Date(Date.now() + result.expires_in * 1000)
      : undefined;

    return {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      expiresAt,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt?: Date;
  }> {
    const dbx = new Dropbox({
      clientId: this.appKey,
      clientSecret: this.appSecret,
    });

    const response = await dbx.auth.refreshAccessToken(refreshToken);
    const result = response.result as any;

    const expiresAt = result.expires_in
      ? new Date(Date.now() + result.expires_in * 1000)
      : undefined;

    return {
      accessToken: result.access_token,
      expiresAt,
    };
  }

  async listFiles(folderId: string, accessToken: string): Promise<CloudFile[]> {
    const dbx = new Dropbox({
      accessToken,
    });

    // Dropbox uses path instead of ID
    const folderPath = folderId.startsWith('/') ? folderId : `/${folderId}`;

    const response = await dbx.filesListFolder({
      path: folderPath,
    });

    const files = response.result.entries.filter(
      entry =>
        entry['.tag'] === 'file' &&
        (entry.name.endsWith('.pdf') ||
          entry.name.match(/\.(jpg|jpeg|png|gif|webp)$/i))
    );

    return files.map((file: any) => ({
      id: file.id,
      name: file.name,
      mimeType: file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      size: file.size,
      modifiedAt: new Date(file.client_modified),
      hash: file.content_hash,
    }));
  }

  async downloadFile(fileId: string, accessToken: string): Promise<Buffer> {
    const dbx = new Dropbox({
      accessToken,
    });

    // Dropbox requires path, but we stored the ID
    // In practice, you'd need to map ID to path or store path instead
    const response = await dbx.filesDownload({ path: fileId });

    const fileBlob = (response.result as any).fileBlob;
    const arrayBuffer = await fileBlob.arrayBuffer();

    return Buffer.from(arrayBuffer);
  }

  async getFolderInfo(folderId: string, accessToken: string): Promise<{
    id: string;
    name: string;
    path?: string;
  }> {
    const dbx = new Dropbox({
      accessToken,
    });

    const folderPath = folderId.startsWith('/') ? folderId : `/${folderId}`;

    const response = await dbx.filesGetMetadata({ path: folderPath });
    const metadata = response.result;

    return {
      id: (metadata as any).id || folderId,
      name: metadata.name,
      path: (metadata as any).path_display || folderPath,
    };
  }
}

