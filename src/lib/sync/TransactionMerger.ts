/**
 * Transaction Merger
 * Handles intelligent merging of uploaded transactions with existing data
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Transaction,
  MergeResult,
  SimilarityResult,
  SourceType,
  NearMatch,
} from './types';
import {
  SpreadsheetDuplicateDetector,
  DuplicateDetectorOptions,
} from './SpreadsheetDuplicateDetector';
import { generateTransactionFingerprint } from './fingerprint';

export interface MergerOptions {
  // Threshold for auto-merge mode
  similarityThreshold?: number;
  
  // How to handle near-matches
  nearMatchStrategy?: 'skip' | 'update' | 'flag' | 'insert';
  
  // Whether to update existing transactions with new data
  updateExisting?: boolean;
  
  // Default source type for new transactions
  sourceType?: SourceType;
  
  // Source identifier (e.g., filename, sheet ID)
  sourceIdentifier?: string;
  
  // Duplicate detector options
  detectorOptions?: DuplicateDetectorOptions;
}

export interface MergeContext {
  userId: string;
  jobId: string;
  tenantId?: string;
  options: MergerOptions;
}

export class TransactionMerger {
  private supabase: SupabaseClient;
  private detector: SpreadsheetDuplicateDetector;
  private defaultOptions: Required<MergerOptions>;

  constructor(
    supabase: SupabaseClient,
    options: MergerOptions = {}
  ) {
    this.supabase = supabase;
    this.defaultOptions = {
      similarityThreshold: options.similarityThreshold ?? 95,
      nearMatchStrategy: options.nearMatchStrategy ?? 'skip',
      updateExisting: options.updateExisting ?? false,
      sourceType: options.sourceType ?? 'upload',
      sourceIdentifier: options.sourceIdentifier ?? '',
      detectorOptions: options.detectorOptions ?? {},
    };
    
    this.detector = new SpreadsheetDuplicateDetector(
      supabase,
      this.defaultOptions.detectorOptions
    );
  }

  /**
   * Process an upload with intelligent merge logic
   */
  async processUpload(
    transactions: Transaction[],
    context: MergeContext
  ): Promise<MergeResult> {
    const options = { ...this.defaultOptions, ...context.options };

    if (!transactions || transactions.length === 0) {
      return {
        mode: 'insert',
        inserted: 0,
        skipped: 0,
        updated: 0,
        similarityScore: 0,
        message: 'No transactions to process',
        jobId: context.jobId,
      };
    }

    // Step 1: Detect similarity with existing data
    const similarity = await this.detector.detectSimilarity(
      transactions,
      context.userId
    );

    // Step 2: Decide merge strategy based on similarity
    if (similarity.similarityScore >= options.similarityThreshold) {
      // High similarity - merge mode
      return this.executeMerge(similarity, context, options);
    } else if (similarity.action === 'merge') {
      // Partial overlap - still merge but insert more
      return this.executeMerge(similarity, context, options);
    } else {
      // Low similarity - insert all
      return this.executeFullInsert(transactions, context, options);
    }
  }

  /**
   * Execute merge: insert only new transactions
   */
  private async executeMerge(
    similarity: SimilarityResult,
    context: MergeContext,
    options: Required<MergerOptions>
  ): Promise<MergeResult> {
    let inserted = 0;
    let updated = 0;
    const skipped = similarity.duplicateTransactions.length;

    // Insert new transactions
    if (similarity.newTransactions.length > 0) {
      const result = await this.insertTransactions(
        similarity.newTransactions,
        context,
        options
      );
      inserted = result.inserted;
    }

    // Handle near-matches based on strategy
    if (similarity.nearMatchTransactions.length > 0) {
      const nearMatchResult = await this.handleNearMatches(
        similarity.nearMatchTransactions,
        context,
        options
      );
      inserted += nearMatchResult.inserted;
      updated += nearMatchResult.updated;
    }

    return {
      mode: 'merge',
      inserted,
      skipped,
      updated,
      similarityScore: similarity.similarityScore,
      matchedJobId: similarity.existingJobId || undefined,
      message: similarity.message,
      jobId: context.jobId,
    };
  }

  /**
   * Execute full insert (no duplicates detected)
   */
  private async executeFullInsert(
    transactions: Transaction[],
    context: MergeContext,
    options: Required<MergerOptions>
  ): Promise<MergeResult> {
    const result = await this.insertTransactions(transactions, context, options);

    return {
      mode: 'insert',
      inserted: result.inserted,
      skipped: 0,
      updated: 0,
      similarityScore: 0,
      message: `Inserted ${result.inserted} transactions`,
      jobId: context.jobId,
    };
  }

  /**
   * Insert transactions with proper fingerprinting and source tracking
   */
  private async insertTransactions(
    transactions: Transaction[],
    context: MergeContext,
    options: Required<MergerOptions>
  ): Promise<{ inserted: number; errors: string[] }> {
    const errors: string[] = [];
    
    // Prepare transactions for insertion
    const transactionsToInsert = transactions.map(tx => {
      const dateStr = typeof tx.date === 'string'
        ? tx.date
        : tx.date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0];

      return {
        job_id: context.jobId,
        original_description: tx.original_description,
        amount: tx.amount,
        date: dateStr,
        category: tx.category || null,
        subcategory: tx.subcategory || null,
        confidence_score: tx.confidence_score ?? 0.5,
        user_confirmed: false,
        source_type: options.sourceType,
        source_identifier: options.sourceIdentifier || null,
        transaction_fingerprint: tx.transaction_fingerprint || 
          generateTransactionFingerprint(tx.original_description, tx.amount, dateStr),
        sync_version: 1,
      };
    });

    // Batch insert
    const BATCH_SIZE = 100;
    let totalInserted = 0;

    for (let i = 0; i < transactionsToInsert.length; i += BATCH_SIZE) {
      const batch = transactionsToInsert.slice(i, i + BATCH_SIZE);
      
      const { data, error } = await this.supabase
        .from('categorized_transactions')
        .insert(batch)
        .select('id');

      if (error) {
        console.error('Batch insert error:', error);
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        totalInserted += data?.length || 0;
      }
    }

    return { inserted: totalInserted, errors };
  }

  /**
   * Handle near-match transactions based on strategy
   */
  private async handleNearMatches(
    nearMatches: NearMatch[],
    context: MergeContext,
    options: Required<MergerOptions>
  ): Promise<{ inserted: number; updated: number }> {
    let inserted = 0;
    let updated = 0;

    switch (options.nearMatchStrategy) {
      case 'skip':
        // Do nothing - skip all near-matches
        break;

      case 'insert':
        // Insert near-matches as new transactions
        const toInsert = nearMatches.map(nm => nm.incoming);
        const result = await this.insertTransactions(toInsert, context, options);
        inserted = result.inserted;
        break;

      case 'update':
        // Update existing transactions with incoming data
        for (const nm of nearMatches) {
          if (nm.existing.id && options.updateExisting) {
            const { error } = await this.supabase
              .from('categorized_transactions')
              .update({
                original_description: nm.incoming.original_description,
                amount: nm.incoming.amount,
                date: nm.incoming.date,
                sync_version: (nm.existing.sync_version || 1) + 1,
                last_modified_source: options.sourceType,
              })
              .eq('id', nm.existing.id);

            if (!error) {
              updated++;
            }
          }
        }
        break;

      case 'flag':
        // Create conflict records for review
        for (const nm of nearMatches) {
          await this.createConflictRecord(nm, context);
        }
        break;
    }

    return { inserted, updated };
  }

  /**
   * Create a conflict record for manual review
   */
  private async createConflictRecord(
    nearMatch: NearMatch,
    context: MergeContext
  ): Promise<void> {
    const { error } = await this.supabase
      .from('sync_conflicts')
      .insert({
        user_id: context.userId,
        tenant_id: context.tenantId || null,
        transaction_id: nearMatch.existing.id || null,
        source_type: context.options.sourceType || 'upload',
        conflict_type: 'update',
        db_value: nearMatch.existing,
        external_value: nearMatch.incoming,
        resolution_status: 'pending',
      });

    if (error) {
      console.error('Error creating conflict record:', error);
    }
  }

  /**
   * Quick check if merge mode should be used
   */
  async shouldUseMergeMode(
    sampleTransactions: Transaction[],
    userId: string
  ): Promise<boolean> {
    const result = await this.detector.isLikelyDuplicate(
      sampleTransactions.length,
      sampleTransactions,
      userId
    );
    return result.isDuplicate;
  }

  /**
   * Get similarity analysis without performing merge
   */
  async analyzeSimilarity(
    transactions: Transaction[],
    userId: string
  ): Promise<SimilarityResult> {
    return this.detector.detectSimilarity(transactions, userId);
  }
}

/**
 * Factory function for creating a transaction merger
 */
export function createTransactionMerger(
  supabase: SupabaseClient,
  options?: MergerOptions
): TransactionMerger {
  return new TransactionMerger(supabase, options);
}

