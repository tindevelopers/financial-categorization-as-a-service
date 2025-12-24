import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@/core/database/server';

/**
 * Wasabi Archive Service
 * Manages document lifecycle between Supabase (hot storage) and Wasabi S3 (cold archive)
 * Cost-effective long-term storage for documents older than 90 days
 */

export class WasabiArchiveService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    const accessKeyId = process.env.WASABI_ACCESS_KEY_ID;
    const secretAccessKey = process.env.WASABI_SECRET_ACCESS_KEY;
    const region = process.env.WASABI_REGION || 'us-east-1';
    const endpoint = process.env.WASABI_ENDPOINT || 's3.wasabisys.com';
    
    this.bucketName = process.env.WASABI_BUCKET_NAME || 'financial-docs-archive';

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('Wasabi credentials not configured');
    }

    this.s3Client = new S3Client({
      region,
      endpoint: `https://${endpoint}`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Archive a document from Supabase Storage to Wasabi S3
   */
  async archiveDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient();

      // Get document details
      const { data: document, error: docError } = await (supabase as any)
        .from('financial_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        return { success: false, error: 'Document not found' };
      }

      // Skip if already archived
      if (document.storage_tier === 'wasabi_archive') {
        return { success: true };
      }

      // Download file from Supabase Storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(document.storage_bucket || 'documents')
        .download(document.storage_path);

      if (downloadError || !fileData) {
        return { success: false, error: `Failed to download file: ${downloadError?.message}` };
      }

      // Convert Blob to Buffer
      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload to Wasabi
      const wasabiPath = `${document.user_id}/${documentId}/${document.original_filename}`;
      
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: wasabiPath,
          Body: buffer,
          ContentType: document.mime_type,
          Metadata: {
            'original-filename': document.original_filename,
            'user-id': document.user_id,
            'document-id': documentId,
            'archived-at': new Date().toISOString(),
          },
        })
      );

      // Update database
      const { error: updateError } = await (supabase as any)
        .from('financial_documents')
        .update({
          storage_tier: 'wasabi_archive',
          wasabi_archive_path: wasabiPath,
          archived_to_wasabi_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      if (updateError) {
        return { success: false, error: `Failed to update database: ${updateError.message}` };
      }

      // Log lifecycle event
      await (supabase as any)
        .from('storage_lifecycle_logs')
        .insert({
          document_id: documentId,
          action: 'archive_to_wasabi',
          from_tier: 'hot',
          to_tier: 'wasabi_archive',
          bytes_moved: buffer.length,
          cost_estimate: this.calculateArchiveCost(buffer.length),
        });

      // Delete from Supabase Storage to save costs
      await supabase.storage
        .from(document.storage_bucket || 'documents')
        .remove([document.storage_path]);

      return { success: true };

    } catch (error: any) {
      console.error('Archive error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Restore a document from Wasabi S3 to Supabase Storage
   */
  async restoreDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient();

      // Get document details
      const { data: document, error: docError } = await (supabase as any)
        .from('financial_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        return { success: false, error: 'Document not found' };
      }

      // Skip if not archived
      if (document.storage_tier !== 'wasabi_archive' || !document.wasabi_archive_path) {
        return { success: true };
      }

      // Update status to restoring
      await (supabase as any)
        .from('financial_documents')
        .update({
          storage_tier: 'restoring',
          restore_from_wasabi_requested_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      // Download from Wasabi
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: document.wasabi_archive_path,
        })
      );

      if (!response.Body) {
        throw new Error('Empty response from Wasabi');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(document.storage_bucket || 'documents')
        .upload(document.storage_path, buffer, {
          contentType: document.mime_type,
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Failed to upload to Supabase: ${uploadError.message}`);
      }

      // Update database
      const { error: updateError } = await (supabase as any)
        .from('financial_documents')
        .update({
          storage_tier: 'hot',
          restore_from_wasabi_requested_at: null,
        })
        .eq('id', documentId);

      if (updateError) {
        throw new Error(`Failed to update database: ${updateError.message}`);
      }

      // Log lifecycle event
      await (supabase as any)
        .from('storage_lifecycle_logs')
        .insert({
          document_id: documentId,
          action: 'restore_from_wasabi',
          from_tier: 'wasabi_archive',
          to_tier: 'hot',
          bytes_moved: buffer.length,
          cost_estimate: this.calculateRestoreCost(buffer.length),
        });

      return { success: true };

    } catch (error: any) {
      console.error('Restore error:', error);
      
      // Reset status on error
      const supabase = await createClient();
      await (supabase as any)
        .from('financial_documents')
        .update({
          storage_tier: 'wasabi_archive',
          restore_from_wasabi_requested_at: null,
        })
        .eq('id', documentId);

      return { success: false, error: error.message };
    }
  }

  /**
   * Get documents eligible for archiving (older than 90 days, in hot storage)
   */
  async getDocumentsEligibleForArchival(userId?: string): Promise<any[]> {
    const supabase = await createClient();
    
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    let query = (supabase as any)
      .from('financial_documents')
      .select('id, user_id, original_filename, file_size, created_at')
      .eq('storage_tier', 'hot')
      .lt('created_at', ninetyDaysAgo.toISOString());

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching eligible documents:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Calculate estimated archive cost (Wasabi pricing)
   * Wasabi: $0.0059/GB/month for storage
   */
  private calculateArchiveCost(bytes: number): number {
    const gb = bytes / (1024 * 1024 * 1024);
    const monthlyCost = gb * 0.0059;
    return monthlyCost;
  }

  /**
   * Calculate estimated restore cost
   * Wasabi: No egress fees for most use cases
   */
  private calculateRestoreCost(bytes: number): number {
    // Wasabi typically has no egress fees for API access
    return 0;
  }

  /**
   * Get archive statistics for a user
   */
  async getArchiveStats(userId: string): Promise<{
    totalArchived: number;
    totalBytes: number;
    estimatedMonthlyCost: number;
    recentArchives: number;
  }> {
    const supabase = await createClient();

    // Get total archived documents
    const { count: totalArchived } = await (supabase as any)
      .from('financial_documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('storage_tier', 'wasabi_archive');

    // Get total bytes archived
    const { data: documents } = await (supabase as any)
      .from('financial_documents')
      .select('file_size')
      .eq('user_id', userId)
      .eq('storage_tier', 'wasabi_archive');

    const totalBytes = (documents || []).reduce((sum: number, doc: any) => sum + (doc.file_size || 0), 0);
    const estimatedMonthlyCost = this.calculateArchiveCost(totalBytes);

    // Get recent archives (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: recentArchives } = await (supabase as any)
      .from('storage_lifecycle_logs')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'archive_to_wasabi')
      .gte('completed_at', thirtyDaysAgo.toISOString());

    return {
      totalArchived: totalArchived || 0,
      totalBytes,
      estimatedMonthlyCost,
      recentArchives: recentArchives || 0,
    };
  }

  /**
   * Delete a document from Wasabi (permanent)
   */
  async deleteFromWasabi(documentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient();

      // Get document details
      const { data: document, error: docError } = await (supabase as any)
        .from('financial_documents')
        .select('wasabi_archive_path, file_size')
        .eq('id', documentId)
        .single();

      if (docError || !document || !document.wasabi_archive_path) {
        return { success: false, error: 'Document not found or not in Wasabi' };
      }

      // Delete from Wasabi
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: document.wasabi_archive_path,
        })
      );

      // Log lifecycle event
      await (supabase as any)
        .from('storage_lifecycle_logs')
        .insert({
          document_id: documentId,
          action: 'delete',
          from_tier: 'wasabi_archive',
          to_tier: null,
          bytes_moved: document.file_size || 0,
        });

      return { success: true };

    } catch (error: any) {
      console.error('Delete from Wasabi error:', error);
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
let wasabiService: WasabiArchiveService | null = null;

export function getWasabiService(): WasabiArchiveService {
  if (!wasabiService) {
    wasabiService = new WasabiArchiveService();
  }
  return wasabiService;
}

