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
    // If skip duplicate check, just insert all
    if (options.skipDuplicateCheck) {
      return this.insertAllTransactions(transactions, options);
    }

    // Detect duplicates
    const similarity = await this.duplicateDetector.detectSimilarity(transactions, this.userId);
    // Always use merge mode to skip duplicate transactions
    // This ensures we never insert duplicates, regardless of similarity score
    if (similarity.matchingCount > 0) {
      return this.mergeTransactions(similarity, options);
    }

    // No duplicates - insert everything
    return this.insertAllTransactions(transactions, options);
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
    if (transactions.length === 0) {      return { inserted: 0, errors: 0 };
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
        original_description: tx.original_description,
        amount: tx.amount,
        date: dateStr,
        transaction_type: tx.transaction_type ?? null,
        is_debit: tx.is_debit ?? null,
        posted_date: tx.posted_date ? this.formatDate(tx.posted_date) : null,
        reference_number: tx.reference_number ?? null,
        merchant_category_code: tx.merchant_category_code ?? null,
        running_balance: tx.running_balance ?? null,
        payee_name: tx.payee_name ?? null,
        payer_name: tx.payer_name ?? null,
        payment_description_reference: tx.payment_description_reference ?? null,
        bank_transaction_type: tx.bank_transaction_type ?? null,
        bank_category: tx.bank_category ?? null,
        bank_subcategory: tx.bank_subcategory ?? null,
        paid_in_amount: tx.paid_in_amount ?? null,
        paid_out_amount: tx.paid_out_amount ?? null,
        category: tx.category || null,
        subcategory: tx.subcategory || null,
        confidence_score: tx.confidence_score || 0.5,
        user_confirmed: false,
        transaction_fingerprint: fingerprint,
        source_type: options.sourceType,
        source_identifier: options.sourceIdentifier || null,
        sync_version: 1,
      };
    });
    const BATCH_SIZE = 100;
    let totalInserted = 0;
    let totalErrors = 0;
    const totalBatches = Math.ceil(transactionsToInsert.length / BATCH_SIZE);
    for (let i = 0; i < transactionsToInsert.length; i += BATCH_SIZE) {
      const batch = transactionsToInsert.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;      
      const { error, data } = await this.supabase
        .from('categorized_transactions')
        .insert(batch)
        .select('id');

      if (error) {        console.error('Error inserting transaction batch:', error);
        totalErrors += batch.length;
      } else {        totalInserted += batch.length;
      }
    }
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

