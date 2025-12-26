/**
 * TransactionMergeService
 * Simplified version for portal app
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { SpreadsheetDuplicateDetector } from './SpreadsheetDuplicateDetector';
import { generateTransactionFingerprint } from './fingerprint';
import type { 
  Transaction, 
  SourceType,
  SimilarityResult
} from './types';

export interface MergeOptions {
  sourceType: SourceType;
  sourceIdentifier?: string;
  jobId?: string;
  createJob?: boolean;
  originalFilename?: string;
  forceMerge?: boolean;
  skipDuplicateCheck?: boolean;
  bankAccountId?: string | null;
}

export interface MergeResult {
  mode: 'insert' | 'merge' | 'reject';
  inserted: number;
  skipped: number;
  updated: number;
  similarityScore: number;
  matchedJobId?: string;
  message: string;
  jobId?: string;
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
    // #region agent log
    console.log('[DEBUG] processUploadWithMerge entry', {
      transactionCount: transactions.length,
      skipDuplicateCheck: options.skipDuplicateCheck,
      forceMerge: options.forceMerge,
      jobId: options.jobId,
      userId: this.userId
    });
    // #endregion
    
    // If skip duplicate check, just insert all
    if (options.skipDuplicateCheck) {
      // #region agent log
      console.log('[DEBUG] Skipping duplicate check, inserting all transactions');
      // #endregion
      return this.insertAllTransactions(transactions, options);
    }

    // Detect duplicates
    // #region agent log
    console.log('[DEBUG] Detecting duplicates');
    // #endregion
    const similarity = await this.duplicateDetector.detectSimilarity(transactions, this.userId);

    // #region agent log
    console.log('[DEBUG] Duplicate detection completed', {
      similarityScore: similarity.similarityScore,
      matchingCount: similarity.matchingCount,
      totalNewTransactions: similarity.totalNewTransactions
    });
    // #endregion

    // Decide on merge strategy based on similarity
    if (similarity.similarityScore < 50 && !options.forceMerge) {
      // Low similarity - insert everything
      // #region agent log
      console.log('[DEBUG] Low similarity, inserting all transactions', {
        similarityScore: similarity.similarityScore
      });
      // #endregion
      return this.insertAllTransactions(transactions, options);
    }

    // Merge mode - only insert new transactions
    // #region agent log
    console.log('[DEBUG] High similarity, merging transactions', {
      similarityScore: similarity.similarityScore,
      newTransactionsCount: similarity.totalNewTransactions
    });
    // #endregion
    return this.mergeTransactions(similarity, options);
  }

  /**
   * Insert all transactions (no duplicate checking)
   */
  private async insertAllTransactions(
    transactions: Transaction[],
    options: MergeOptions
  ): Promise<MergeResult> {
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

    const insertResult = await this.insertTransactions(transactions, jobId, options);

    return {
      mode: 'insert',
      inserted: insertResult.inserted,
      skipped: 0,
      updated: 0,
      similarityScore: 0,
      jobId: jobId,
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
    if (similarity.totalNewTransactions === 0) {
      return {
        mode: 'merge',
        inserted: 0,
        skipped: similarity.matchingCount,
        updated: 0,
        similarityScore: similarity.similarityScore,
        matchedJobId: similarity.existingJobId ?? undefined,
        message: `All ${similarity.matchingCount} transactions already exist. No new data added.`,
      };
    }

    let jobId = options.jobId;
    if (!jobId && options.createJob !== false) {
      jobId = (await this.createJob(options)) ?? undefined;
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

    const insertResult = await this.insertTransactions(similarity.newTransactions, jobId, options);

    return {
      mode: 'merge',
      inserted: insertResult.inserted,
      skipped: similarity.matchingCount,
      updated: 0,
      similarityScore: similarity.similarityScore,
      matchedJobId: similarity.existingJobId ?? undefined,
      jobId: jobId,
      message: `Merged: ${insertResult.inserted} new, ${similarity.matchingCount} skipped (duplicates)`,
    };
  }

  /**
   * Insert transactions into the database
   */
  private async insertTransactions(
    transactions: Transaction[],
    jobId: string,
    options: MergeOptions
  ): Promise<{ inserted: number; errors: number }> {
    // #region agent log
    console.log('[DEBUG] insertTransactions entry', {
      transactionCount: transactions.length,
      jobId,
      userId: this.userId,
      tenantId: this.tenantId,
      bankAccountId: options.bankAccountId
    });
    // #endregion
    
    if (transactions.length === 0) {
      // #region agent log
      console.log('[DEBUG] No transactions to insert');
      // #endregion
      return { inserted: 0, errors: 0 };
    }

    const transactionsToInsert = transactions.map(tx => {
      const dateStr = this.formatDate(tx.date);
      const fingerprint = tx.transaction_fingerprint || generateTransactionFingerprint(
        tx.original_description,
        tx.amount,
        dateStr
      );

      return {
        job_id: jobId,
        user_id: this.userId,
        tenant_id: this.tenantId,
        original_description: tx.original_description,
        amount: tx.amount,
        date: dateStr,
        category: tx.category || null,
        subcategory: tx.subcategory || null,
        confidence_score: tx.confidence_score || 0.5,
        user_confirmed: false,
        transaction_fingerprint: fingerprint,
        source_type: options.sourceType,
        source_identifier: options.sourceIdentifier || null,
        sync_version: 1,
        bank_account_id: options.bankAccountId || null,
      };
    });

    // #region agent log
    const categorizedCount = transactionsToInsert.filter(tx => tx.category).length;
    console.log('[DEBUG] Transactions prepared for insertion', {
      totalCount: transactionsToInsert.length,
      categorizedCount,
      uncategorizedCount: transactionsToInsert.length - categorizedCount,
      sampleTransaction: transactionsToInsert[0] ? {
        description: transactionsToInsert[0].original_description?.substring(0, 50),
        amount: transactionsToInsert[0].amount,
        category: transactionsToInsert[0].category,
        subcategory: transactionsToInsert[0].subcategory
      } : null
    });
    // #endregion

    const BATCH_SIZE = 100;
    let totalInserted = 0;
    let totalErrors = 0;
    const totalBatches = Math.ceil(transactionsToInsert.length / BATCH_SIZE);

    // #region agent log
    console.log('[DEBUG] Starting batch insertion', {
      totalTransactions: transactionsToInsert.length,
      batchSize: BATCH_SIZE,
      totalBatches
    });
    // #endregion

    for (let i = 0; i < transactionsToInsert.length; i += BATCH_SIZE) {
      const batch = transactionsToInsert.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      // #region agent log
      console.log('[DEBUG] Inserting transaction batch', {
        batchNumber,
        totalBatches,
        batchSize: batch.length,
        batchStartIndex: i,
        jobId
      });
      // #endregion
      
      const { error, data } = await this.supabase
        .from('categorized_transactions')
        .insert(batch)
        .select('id');

      if (error) {
        // #region agent log
        console.log('[DEBUG] Error inserting transaction batch', {
          batchNumber,
          errorMessage: error.message,
          errorCode: error.code,
          errorDetails: error.details,
          errorHint: error.hint,
          batchSize: batch.length
        });
        // #endregion
        console.error('Error inserting transaction batch:', error);
        totalErrors += batch.length;
      } else {
        // #region agent log
        console.log('[DEBUG] Transaction batch inserted successfully', {
          batchNumber,
          insertedCount: data?.length || batch.length,
          batchSize: batch.length
        });
        // #endregion
        totalInserted += batch.length;
      }
    }

    // #region agent log
    console.log('[DEBUG] All batches processed', {
      totalInserted,
      totalErrors,
      successRate: transactionsToInsert.length > 0 ? (totalInserted / transactionsToInsert.length * 100).toFixed(2) + '%' : '0%',
      jobId
    });
    // #endregion

    return { inserted: totalInserted, errors: totalErrors };
  }

  /**
   * Create a new categorization job
   */
  private async createJob(options: MergeOptions): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('categorization_jobs')
      .insert({
        user_id: this.userId,
        tenant_id: this.tenantId,
        job_type: 'spreadsheet',
        status: 'processing',
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
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
      return date;
    }
    return date.toISOString().split('T')[0];
  }
}

/**
 * Factory function for creating a merge service
 */
export function createMergeService(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string | null = null
): TransactionMergeService {
  return new TransactionMergeService(supabase, userId, tenantId);
}

