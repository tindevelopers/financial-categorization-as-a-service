/**
 * TransactionMergeService
 * 
 * Handles intelligent merging of transactions during upload.
 * When duplicates are detected, this service:
 * - Inserts only new transactions
 * - Skips exact duplicates
 * - Optionally handles near-matches based on configuration
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { SpreadsheetDuplicateDetector } from './SpreadsheetDuplicateDetector';
import { generateFingerprints, generateTransactionFingerprint } from './fingerprint';
import type { 
  Transaction, 
  MergeResult,
  SourceType,
  SimilarityResult
} from './types';

export interface MergeOptions {
  /** Source type for the incoming transactions */
  sourceType: SourceType;
  /** External identifier (filename, sheet ID, etc.) */
  sourceIdentifier?: string;
  /** Job ID to associate transactions with (if already created) */
  jobId?: string;
  /** Whether to create a new job if jobId is not provided */
  createJob?: boolean;
  /** Original filename for job record */
  originalFilename?: string;
  /** Force merge even if similarity is low */
  forceMerge?: boolean;
  /** Skip duplicate detection entirely */
  skipDuplicateCheck?: boolean;
}

export class TransactionMergeService {
  private supabase: SupabaseClient;
  private userId: string;
  private tenantId: string | null;
  private duplicateDetector: SpreadsheetDuplicateDetector;

  constructor(
    supabase: SupabaseClient, 
    userId: string,
    tenantId: string | null = null
  ) {
    this.supabase = supabase;
    this.userId = userId;
    this.tenantId = tenantId;
    this.duplicateDetector = new SpreadsheetDuplicateDetector(supabase);
  }

  /**
   * Process an upload with intelligent merge logic
   */
  async processUploadWithMerge(
    transactions: Transaction[],
    options: MergeOptions
  ): Promise<MergeResult> {
    const startTime = Date.now();

    // If skip duplicate check, just insert all
    if (options.skipDuplicateCheck) {
      return this.insertAllTransactions(transactions, options);
    }

    // Detect duplicates
    const similarity = await this.duplicateDetector.detectSimilarity(transactions, this.userId);

    // Decide on merge strategy based on similarity
    if (similarity.action === 'proceed' && !options.forceMerge) {
      // All new - insert everything
      return this.insertAllTransactions(transactions, options);
    }

    // Merge mode - only insert new transactions
    return this.mergeTransactions(similarity, options);
  }

  /**
   * Insert all transactions (no duplicate checking)
   */
  private async insertAllTransactions(
    transactions: Transaction[],
    options: MergeOptions
  ): Promise<MergeResult> {
    // Ensure we have a job ID
    let jobId: string | null | undefined = options.jobId;
    if (!jobId && options.createJob !== false) {
      jobId = await this.createJob(options);
    }

    if (!jobId) {
      return {
        mode: 'reject',
        inserted: 0,
        skipped: 0,
        updated: 0,
        similarityScore: 0,
        message: 'Failed to create categorization job',
      };
    }

    // Add fingerprints
    const fingerprintMap = generateFingerprints(transactions);
    const transactionsWithFingerprints = Array.from(fingerprintMap.values());

    // Insert all transactions
    const insertResult = await this.insertTransactions(
      transactionsWithFingerprints,
      jobId,
      options
    );

    return {
      mode: 'insert',
      inserted: insertResult.inserted,
      skipped: 0,
      updated: 0,
      newJobId: jobId,
      message: `Inserted ${insertResult.inserted} transaction(s)`,
    };
  }

  /**
   * Merge transactions - only insert new ones
   */
  private async mergeTransactions(
    similarity: SimilarityResult,
    options: MergeOptions
  ): Promise<MergeResult> {
    // If no new transactions, nothing to do
    if (similarity.newCount === 0) {
      return {
        mode: 'merge',
        inserted: 0,
        skipped: similarity.matchingCount,
        updated: 0,
        similarityScore: similarity.similarityScore,
        matchedJobId: similarity.existingJobId,
        message: `All ${similarity.matchingCount} transactions already exist. No new data added.`,
      };
    }

    // Determine which job to use
    let jobId = options.jobId;
    
    // If high similarity and existing job, could add to that job
    // For now, we always create a new job for clarity
    if (!jobId && options.createJob !== false) {
      jobId = await this.createJob(options);
    }

    if (!jobId) {
      return {
        mode: 'reject',
        inserted: 0,
        skipped: 0,
        updated: 0,
        similarityScore: 0,
        message: 'Failed to create categorization job',
      };
    }

    // Insert only new transactions
    const insertResult = await this.insertTransactions(
      similarity.newTransactions,
      jobId,
      options
    );

    return {
      mode: 'merge',
      inserted: insertResult.inserted,
      skipped: similarity.matchingCount,
      updated: 0,
      similarityScore: similarity.similarityScore,
      matchedJobId: similarity.existingJobId,
      newJobId: jobId,
      message: `Merged: ${insertResult.inserted} new, ${similarity.matchingCount} skipped (duplicates)`,
    };
  }

  /**
   * Insert transactions into the database
   */
  private async insertTransactions(
    transactions: TransactionWithFingerprint[],
    jobId: string,
    options: MergeOptions
  ): Promise<{ inserted: number; errors: number }> {
    if (transactions.length === 0) {
      return { inserted: 0, errors: 0 };
    }

    const transactionsToInsert = transactions.map(tx => ({
      job_id: jobId,
      original_description: tx.description,
      amount: tx.amount,
      date: this.formatDate(tx.date),
      category: tx.category || null,
      subcategory: tx.subcategory || null,
      confidence_score: 0.5, // Default confidence
      user_confirmed: false,
      source_type: options.sourceType,
      source_identifier: options.sourceIdentifier || null,
      sync_version: 1,
    }));

    // Insert in batches to avoid hitting limits
    const BATCH_SIZE = 100;
    let totalInserted = 0;
    let totalErrors = 0;

    for (let i = 0; i < transactionsToInsert.length; i += BATCH_SIZE) {
      const batch = transactionsToInsert.slice(i, i + BATCH_SIZE);
      
      const { error } = await (this.supabase as any)
        .from('categorized_transactions')
        .insert(batch);

      if (error) {
        console.error('Error inserting transaction batch:', error);
        totalErrors += batch.length;
      } else {
        totalInserted += batch.length;
      }
    }

    // Update job with item counts
    await (this.supabase as any)
      .from('categorization_jobs')
      .update({
        total_items: totalInserted,
        processed_items: totalInserted,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    return { inserted: totalInserted, errors: totalErrors };
  }

  /**
   * Create a new categorization job
   */
  private async createJob(options: MergeOptions): Promise<string | null> {
    const { data, error } = await (this.supabase as any)
      .from('categorization_jobs')
      .insert({
        user_id: this.userId,
        tenant_id: this.tenantId,
        job_type: 'spreadsheet',
        status: 'processing',
        processing_mode: 'sync',
        original_filename: options.originalFilename || 'Merged upload',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating job:', error);
      return null;
    }

    return data?.id || null;
  }

  /**
   * Format date consistently
   */
  private formatDate(date: string | Date): string {
    if (typeof date === 'string') {
      // Try to parse and normalize
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
      return date;
    }
    return date.toISOString().split('T')[0];
  }

  /**
   * Preview what would happen if we merged these transactions
   * (Does not actually insert anything)
   */
  async previewMerge(
    transactions: Transaction[]
  ): Promise<SimilarityResult> {
    return this.duplicateDetector.detectSimilarity(transactions);
  }

  /**
   * Update an existing transaction (for sync updates)
   */
  async updateTransaction(
    transactionId: string,
    updates: Partial<Transaction>,
    sourceType: SourceType
  ): Promise<boolean> {
    const updateData: Record<string, unknown> = {};
    
    if (updates.description !== undefined) {
      updateData.original_description = updates.description;
    }
    if (updates.amount !== undefined) {
      updateData.amount = updates.amount;
    }
    if (updates.date !== undefined) {
      updateData.date = this.formatDate(updates.date);
    }
    if (updates.category !== undefined) {
      updateData.category = updates.category;
    }
    if (updates.subcategory !== undefined) {
      updateData.subcategory = updates.subcategory;
    }

    updateData.last_modified_source = sourceType;
    updateData.updated_at = new Date().toISOString();

    const { error } = await this.supabase
      .from('categorized_transactions')
      .update(updateData)
      .eq('id', transactionId);

    if (error) {
      console.error('Error updating transaction:', error);
      return false;
    }

    return true;
  }

  /**
   * Batch update multiple transactions
   */
  async batchUpdate(
    updates: Array<{ id: string; updates: Partial<Transaction> }>,
    sourceType: SourceType
  ): Promise<{ updated: number; failed: number }> {
    let updated = 0;
    let failed = 0;

    for (const item of updates) {
      const success = await this.updateTransaction(item.id, item.updates, sourceType);
      if (success) {
        updated++;
      } else {
        failed++;
      }
    }

    return { updated, failed };
  }
}

/**
 * Factory function to create a TransactionMergeService
 */
export function createMergeService(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string | null = null
): TransactionMergeService {
  return new TransactionMergeService(supabase, userId, tenantId);
}

