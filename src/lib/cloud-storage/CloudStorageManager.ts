import { createClient } from '@/core/database/server';

/**
 * Cloud Storage Manager
 * Factory pattern for managing multiple cloud storage providers
 * Supports: Google Drive, Dropbox, Box, OneDrive
 */

export interface CloudFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedAt: Date;
  downloadUrl?: string;
  hash?: string;
}

export interface CloudStorageProvider {
  provider: 'google_drive' | 'dropbox' | 'box' | 'onedrive';
  
  /**
   * Initialize OAuth flow
   */
  getAuthorizationUrl(redirectUri: string, state?: string): string;
  
  /**
   * Exchange authorization code for tokens
   */
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }>;
  
  /**
   * Refresh access token
   */
  refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt?: Date;
  }>;
  
  /**
   * List files in a folder
   */
  listFiles(folderId: string, accessToken: string): Promise<CloudFile[]>;
  
  /**
   * Download a file
   */
  downloadFile(fileId: string, accessToken: string): Promise<Buffer>;
  
  /**
   * Get folder information
   */
  getFolderInfo(folderId: string, accessToken: string): Promise<{
    id: string;
    name: string;
    path?: string;
  }>;
  
  /**
   * Setup webhook for real-time notifications (if supported)
   */
  setupWebhook?(folderId: string, accessToken: string, webhookUrl: string): Promise<{
    webhookId: string;
    webhookUrl: string;
  }>;
  
  /**
   * Remove webhook
   */
  removeWebhook?(webhookId: string, accessToken: string): Promise<void>;
}

export class CloudStorageManager {
  private providers: Map<string, CloudStorageProvider> = new Map();

  constructor() {
    // Providers are registered dynamically to avoid loading all dependencies
  }

  /**
   * Register a provider
   */
  registerProvider(provider: CloudStorageProvider): void {
    this.providers.set(provider.provider, provider);
  }

  /**
   * Get a provider by name
   */
  getProvider(providerName: string): CloudStorageProvider | null {
    return this.providers.get(providerName) || null;
  }

  /**
   * Create a new cloud storage integration
   */
  async createIntegration(
    userId: string,
    provider: 'google_drive' | 'dropbox' | 'box' | 'onedrive',
    folderId: string,
    folderName: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date
  ): Promise<string> {
    const supabase = await createClient();

    // Encrypt tokens before storing
    const accessTokenEncrypted = this.encryptToken(accessToken);
    const refreshTokenEncrypted = refreshToken ? this.encryptToken(refreshToken) : null;

    const { data, error } = await supabase
      .from('cloud_storage_integrations')
      .insert({
        user_id: userId,
        provider,
        folder_id: folderId,
        folder_name: folderName,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: expiresAt?.toISOString(),
        auto_sync_enabled: true,
        sync_frequency: '15min',
        last_sync_status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create integration: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Get integration by ID
   */
  async getIntegration(integrationId: string): Promise<any> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('cloud_storage_integrations')
      .select('*')
      .eq('id', integrationId)
      .single();

    if (error) {
      throw new Error(`Integration not found: ${error.message}`);
    }

    // Decrypt tokens
    data.access_token = this.decryptToken(data.access_token_encrypted);
    if (data.refresh_token_encrypted) {
      data.refresh_token = this.decryptToken(data.refresh_token_encrypted);
    }

    return data;
  }

  /**
   * Sync files from a cloud storage integration
   */
  async syncIntegration(integrationId: string): Promise<{
    filesFound: number;
    filesProcessed: number;
    filesUploaded: number;
    filesSkipped: number;
    filesFailed: number;
  }> {
    const supabase = await createClient();

    // Get integration
    const integration = await this.getIntegration(integrationId);
    
    // Get provider
    const provider = this.getProvider(integration.provider);
    if (!provider) {
      throw new Error(`Provider ${integration.provider} not supported`);
    }

    // Create sync log
    const { data: syncLog, error: logError } = await supabase
      .from('cloud_storage_sync_logs')
      .insert({
        integration_id: integrationId,
        user_id: integration.user_id,
        sync_type: 'manual',
        status: 'in_progress',
      })
      .select('id')
      .single();

    if (logError) {
      throw new Error(`Failed to create sync log: ${logError.message}`);
    }

    try {
      // Update integration status
      await supabase
        .from('cloud_storage_integrations')
        .update({
          last_sync_status: 'in_progress',
          last_sync_at: new Date().toISOString(),
        })
        .eq('id', integrationId);

      // List files
      const files = await provider.listFiles(integration.folder_id, integration.access_token);

      let filesProcessed = 0;
      let filesUploaded = 0;
      let filesSkipped = 0;
      let filesFailed = 0;

      // Process each file
      for (const file of files) {
        try {
          // Check if file already synced
          const { data: existingFile } = await supabase
            .from('cloud_storage_files')
            .select('id, provider_hash')
            .eq('integration_id', integrationId)
            .eq('provider_file_id', file.id)
            .single();

          // Skip if already synced and hash matches
          if (existingFile && existingFile.provider_hash === file.hash) {
            filesSkipped++;
            continue;
          }

          // Download file
          const fileBuffer = await provider.downloadFile(file.id, integration.access_token);

          // Upload to our system
          const documentId = await this.uploadDocument(
            integration.user_id,
            file.name,
            fileBuffer,
            file.mimeType
          );

          // Track in cloud_storage_files
          if (existingFile) {
            // Update existing
            await supabase
              .from('cloud_storage_files')
              .update({
                financial_document_id: documentId,
                provider_hash: file.hash,
                provider_modified_at: file.modifiedAt.toISOString(),
                sync_status: 'synced',
                last_synced_at: new Date().toISOString(),
              })
              .eq('id', existingFile.id);
          } else {
            // Create new
            await supabase
              .from('cloud_storage_files')
              .insert({
                integration_id: integrationId,
                user_id: integration.user_id,
                provider_file_id: file.id,
                provider_file_name: file.name,
                provider_modified_at: file.modifiedAt.toISOString(),
                provider_size_bytes: file.size,
                provider_hash: file.hash,
                financial_document_id: documentId,
                sync_status: 'synced',
              });
          }

          filesUploaded++;
          filesProcessed++;

        } catch (error: any) {
          console.error(`Failed to process file ${file.name}:`, error);
          filesFailed++;
        }
      }

      // Update sync log
      await supabase
        .from('cloud_storage_sync_logs')
        .update({
          status: 'completed',
          files_found: files.length,
          files_processed: filesProcessed,
          files_uploaded: filesUploaded,
          files_skipped: filesSkipped,
          files_failed: filesFailed,
        })
        .eq('id', syncLog.id);

      // Update integration
      await supabase
        .from('cloud_storage_integrations')
        .update({
          last_sync_status: 'success',
          files_synced: (integration.files_synced || 0) + filesUploaded,
        })
        .eq('id', integrationId);

      return {
        filesFound: files.length,
        filesProcessed,
        filesUploaded,
        filesSkipped,
        filesFailed,
      };

    } catch (error: any) {
      console.error('Sync error:', error);

      // Update sync log
      await supabase
        .from('cloud_storage_sync_logs')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', syncLog.id);

      // Update integration
      await supabase
        .from('cloud_storage_integrations')
        .update({
          last_sync_status: 'failed',
          last_sync_error: error.message,
        })
        .eq('id', integrationId);

      throw error;
    }
  }

  /**
   * Upload document to our system
   */
  private async uploadDocument(
    userId: string,
    filename: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<string> {
    const supabase = await createClient();
    const { nanoid } = await import('nanoid');

    // Upload to storage
    const storagePath = `${userId}/cloud-sync/${nanoid()}-${filename}`;
    
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Create financial_documents record
    const { data: document, error: docError } = await supabase
      .from('financial_documents')
      .insert({
        user_id: userId,
        original_filename: filename,
        storage_path: storagePath,
        storage_bucket: 'documents',
        storage_tier: 'hot',
        mime_type: mimeType,
        file_size: buffer.length,
        file_hash: '',
        source: 'cloud_sync',
        ocr_status: 'pending',
        reconciliation_status: 'unreconciled',
      })
      .select('id')
      .single();

    if (docError) {
      throw new Error(`Document creation failed: ${docError.message}`);
    }

    // Trigger OCR
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/documents/process-ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: document.id }),
    }).catch(err => console.error('OCR trigger error:', err));

    return document.id;
  }

  /**
   * Encrypt token (placeholder - use proper encryption in production)
   */
  private encryptToken(token: string): string {
    // TODO: Implement proper encryption using KMS or similar
    // For now, just base64 encode (NOT SECURE FOR PRODUCTION)
    return Buffer.from(token).toString('base64');
  }

  /**
   * Decrypt token (placeholder - use proper decryption in production)
   */
  private decryptToken(encryptedToken: string): string {
    // TODO: Implement proper decryption using KMS or similar
    // For now, just base64 decode (NOT SECURE FOR PRODUCTION)
    return Buffer.from(encryptedToken, 'base64').toString('utf-8');
  }
}

// Singleton instance
let cloudStorageManager: CloudStorageManager | null = null;

export function getCloudStorageManager(): CloudStorageManager {
  if (!cloudStorageManager) {
    cloudStorageManager = new CloudStorageManager();
  }
  return cloudStorageManager;
}

