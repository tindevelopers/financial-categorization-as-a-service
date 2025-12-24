/**
 * Type declarations for cloud storage SDK packages
 * These are placeholders for packages not yet installed
 */

declare module 'box-node-sdk' {
  export default class BoxSDK {
    constructor(options: { clientID: string; clientSecret: string });
    getAuthorizeURL(options: { response_type: string; redirect_uri: string; state?: string }): string;
    getTokensAuthorizationCodeGrant(code: string): Promise<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
    }>;
    getTokensRefreshGrant(refreshToken: string): Promise<{
      access_token: string;
      expires_in: number;
    }>;
    getBasicClient(accessToken: string): {
      folders: {
        getItems(folderId: string, options: { fields: string }): Promise<{ entries: any[] }>;
        get(folderId: string, options?: { fields: string }): Promise<{ id: string; name: string; path_collection: { entries: any[] } }>;
      };
      files: {
        getReadStream(fileId: string): Promise<AsyncIterable<Buffer>>;
      };
      webhooks: {
        create(targetId: string, targetType: string, address: string, triggers: string[]): Promise<{ id: string; address: string }>;
        delete(webhookId: string): Promise<void>;
      };
    };
  }
}

declare module 'dropbox' {
  export class Dropbox {
    constructor(options: { clientId?: string; clientSecret?: string; accessToken?: string; refreshToken?: string });
    auth: {
      getAuthenticationUrl(
        redirectUri: string, 
        state?: string, 
        authType?: string, 
        tokenAccessType?: string, 
        scope?: any, 
        includeGrantedScopes?: any,
        usePKCE?: boolean
      ): string;
      getAccessTokenFromCode(redirectUri: string, code: string): Promise<{ result: { access_token: string; refresh_token: string; expires_in: number } }>;
      refreshAccessToken(refreshToken?: string): Promise<{ result: { access_token: string; expires_in: number } }>;
    };
    filesListFolder(options: { path: string; include_deleted?: boolean }): Promise<{ result: { entries: any[] } }>;
    filesDownload(options: { path: string }): Promise<{ result: { fileBinary: any } }>;
    filesGetMetadata(options: { path: string }): Promise<{ result: { name: string; path_display: string } }>;
  }
}

declare module '@microsoft/microsoft-graph-client' {
  export class Client {
    static init(options: { authProvider: (done: (err: any, token: string) => void) => void }): Client;
    api(path: string): {
      get(): Promise<any>;
      getStream(): Promise<AsyncIterable<Buffer>>;
      select(fields: string): { get(): Promise<any> };
    };
  }
}

