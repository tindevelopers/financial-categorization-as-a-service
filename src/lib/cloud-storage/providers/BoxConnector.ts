import { CloudStorageProvider, CloudFile } from '../CloudStorageManager';
import BoxSDK from 'box-node-sdk';

/**
 * Box Connector
 * Handles OAuth and file operations for Box
 */

export class BoxConnector implements CloudStorageProvider {
  provider: 'box' = 'box';
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.BOX_CLIENT_ID || '';
    this.clientSecret = process.env.BOX_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Box credentials not configured');
    }
  }

  getAuthorizationUrl(redirectUri: string, state?: string): string {
    const sdk = new BoxSDK({
      clientID: this.clientId,
      clientSecret: this.clientSecret,
    });

    return sdk.getAuthorizeURL({
      response_type: 'code',
      redirect_uri: redirectUri,
      state: state || '',
    });
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    const sdk = new BoxSDK({
      clientID: this.clientId,
      clientSecret: this.clientSecret,
    });

    const tokenInfo = await sdk.getTokensAuthorizationCodeGrant(code);

    const expiresAt = new Date(Date.now() + tokenInfo.expires_in * 1000);

    return {
      accessToken: tokenInfo.access_token,
      refreshToken: tokenInfo.refresh_token,
      expiresAt,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt?: Date;
  }> {
    const sdk = new BoxSDK({
      clientID: this.clientId,
      clientSecret: this.clientSecret,
    });

    const tokenInfo = await sdk.getTokensRefreshGrant(refreshToken);

    const expiresAt = new Date(Date.now() + tokenInfo.expires_in * 1000);

    return {
      accessToken: tokenInfo.access_token,
      expiresAt,
    };
  }

  async listFiles(folderId: string, accessToken: string): Promise<CloudFile[]> {
    const sdk = new BoxSDK({
      clientID: this.clientId,
      clientSecret: this.clientSecret,
    });

    const client = sdk.getBasicClient(accessToken);

    const items = await client.folders.getItems(folderId, {
      fields: 'id,name,size,modified_at,sha1',
    });

    // Filter for PDFs and images
    const files = items.entries.filter(
      (item: any) =>
        item.type === 'file' &&
        (item.name.endsWith('.pdf') ||
          item.name.match(/\.(jpg|jpeg|png|gif|webp)$/i))
    );

    return files.map((file: any) => ({
      id: file.id,
      name: file.name,
      mimeType: file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      size: file.size,
      modifiedAt: new Date(file.modified_at),
      hash: file.sha1,
    }));
  }

  async downloadFile(fileId: string, accessToken: string): Promise<Buffer> {
    const sdk = new BoxSDK({
      clientID: this.clientId,
      clientSecret: this.clientSecret,
    });

    const client = sdk.getBasicClient(accessToken);

    const stream = await client.files.getReadStream(fileId);

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
    const sdk = new BoxSDK({
      clientID: this.clientId,
      clientSecret: this.clientSecret,
    });

    const client = sdk.getBasicClient(accessToken);

    const folder = await client.folders.get(folderId, { fields: 'id,name,path_collection' });

    // Build path from path_collection
    const pathParts = folder.path_collection.entries.map((entry: any) => entry.name);
    const path = [...pathParts, folder.name].join('/');

    return {
      id: folder.id,
      name: folder.name,
      path,
    };
  }
}

