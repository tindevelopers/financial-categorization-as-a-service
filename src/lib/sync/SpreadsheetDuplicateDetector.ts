/**
 * Spreadsheet Duplicate Detector
 * Detects when uploaded spreadsheets contain duplicate or similar data
 * to existing transactions in the database
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  Transaction, 
  SimilarityResult, 
  NearMatch,
  FingerprintMatch 
} from './types';
import { 
  generateTransactionFingerprint, 
  extractFingerprints,
  areTransactionsNearMatch 
} from './fingerprint';

// Threshold for considering an upload as a duplicate
const SIMILARITY_THRESHOLD = 95;

// Threshold for flagging as potential partial duplicate
const PARTIAL_SIMILARITY_THRESHOLD = 50;

export interface DuplicateDetectorOptions {
  similarityThreshold?: number;
  checkNearMatches?: boolean;
  nearMatchThresholds?: {
    amountDiffPercent?: number;
    dateDiffDays?: number;
    descriptionSimilarity?: number;
  };
}

interface InternalOptions {
  similarityThreshold: number;
  checkNearMatches: boolean;
  nearMatchThresholds: {
    amountDiffPercent: number;
    dateDiffDays: number;
    descriptionSimilarity: number;
  };
}

export class SpreadsheetDuplicateDetector {
  private supabase: SupabaseClient;
  private options: InternalOptions;

  constructor(
    supabase: SupabaseClient,
    options: DuplicateDetectorOptions = {}
  ) {
    this.supabase = supabase;
    this.options = {
      similarityThreshold: options.similarityThreshold ?? SIMILARITY_THRESHOLD,
      checkNearMatches: options.checkNearMatches ?? true,
      nearMatchThresholds: {
        amountDiffPercent: options.nearMatchThresholds?.amountDiffPercent ?? 1,
        dateDiffDays: options.nearMatchThresholds?.dateDiffDays ?? 3,
        descriptionSimilarity: options.nearMatchThresholds?.descriptionSimilarity ?? 80,
      },
    };
  }

  /**
   * Detect similarity between new transactions and existing user data
   */
  async detectSimilarity(
    newTransactions: Transaction[],
    userId: string
  ): Promise<SimilarityResult> {
    if (!newTransactions || newTransactions.length === 0) {
      return {
        similarityScore: 0,
        totalNewTransactions: 0,
        matchingCount: 0,
        existingJobId: null,
        existingJobIds: [],
        newTransactions: [],
        duplicateTransactions: [],
        nearMatchTransactions: [],
        action: 'proceed',
        message: 'No transactions to process',
      };
    }

    // Generate fingerprints for new transactions
    const newFingerprints = newTransactions.map(tx => {
      const dateStr = typeof tx.date === 'string' 
        ? tx.date 
        : tx.date?.toISOString().split('T')[0] || '';
      
      return {
        transaction: tx,
        fingerprint: generateTransactionFingerprint(
          tx.original_description,
          tx.amount,
          dateStr
        ),
      };
    });

    const fingerprintArray = newFingerprints.map(f => f.fingerprint);

    // Query database for matching fingerprints
    const { data: matchResult, error: matchError } = await this.supabase.rpc(
      'calculate_fingerprint_similarity',
      {
        p_user_id: userId,
        p_new_fingerprints: fingerprintArray,
      }
    ) as { data: Array<{ total_new: number; matching_count: number; similarity_percentage: number }> | null; error: unknown };

    if (matchError) {
      console.error('Error calculating fingerprint similarity:', matchError);
      // Fall back to manual calculation
      return this.manualSimilarityCheck(newTransactions, userId);
    }

    const similarityData = matchResult?.[0] || {
      total_new: newTransactions.length,
      matching_count: 0,
      similarity_percentage: 0,
    };

    // Get detailed matching info
    const { data: duplicates, error: dupError } = await this.supabase.rpc(
      'find_duplicate_transactions',
      {
        p_user_id: userId,
        p_fingerprints: fingerprintArray,
      }
    ) as { data: FingerprintMatch[] | null; error: unknown };

    if (dupError) {
      console.error('Error finding duplicates:', dupError);
    }

    const matchingFingerprints = new Set(
      (duplicates || []).map(d => d.fingerprint)
    );

    // Categorize transactions
    const duplicateTransactions: Transaction[] = [];
    const newTransactionsToInsert: Transaction[] = [];
    const nearMatchTransactions: NearMatch[] = [];

    for (const { transaction, fingerprint } of newFingerprints) {
      if (matchingFingerprints.has(fingerprint)) {
        duplicateTransactions.push({
          ...transaction,
          transaction_fingerprint: fingerprint,
        });
      } else {
        newTransactionsToInsert.push({
          ...transaction,
          transaction_fingerprint: fingerprint,
        });
      }
    }

    // Check for near-matches if enabled
    if (this.options.checkNearMatches && newTransactionsToInsert.length > 0) {
      const nearMatches = await this.findNearMatches(
        newTransactionsToInsert,
        userId
      );
      nearMatchTransactions.push(...nearMatches);
    }

    // Find which job(s) have the most matches
    const jobMatchCounts = new Map<string, number>();
    for (const dup of duplicates || []) {
      const count = jobMatchCounts.get(dup.job_id) || 0;
      jobMatchCounts.set(dup.job_id, count + 1);
    }

    const sortedJobs = [...jobMatchCounts.entries()]
      .sort((a, b) => b[1] - a[1]);

    const existingJobId = sortedJobs.length > 0 ? sortedJobs[0][0] : null;
    const existingJobIds = sortedJobs.map(j => j[0]);

    // Determine action based on similarity
    const similarityScore = similarityData.similarity_percentage;
    let action: 'reject' | 'merge' | 'proceed';
    let message: string;

    if (similarityScore >= this.options.similarityThreshold) {
      action = 'merge';
      message = `${similarityScore.toFixed(1)}% of transactions already exist. ` +
        `${newTransactionsToInsert.length} new transaction(s) will be added.`;
    } else if (similarityScore >= PARTIAL_SIMILARITY_THRESHOLD) {
      action = 'merge';
      message = `${similarityScore.toFixed(1)}% overlap detected. ` +
        `${newTransactionsToInsert.length} new and ${duplicateTransactions.length} duplicate transaction(s).`;
    } else {
      action = 'proceed';
      message = `Low similarity (${similarityScore.toFixed(1)}%). ` +
        `All ${newTransactions.length} transactions will be inserted.`;
    }

    return {
      similarityScore,
      totalNewTransactions: newTransactions.length,
      matchingCount: similarityData.matching_count,
      existingJobId,
      existingJobIds,
      newTransactions: newTransactionsToInsert,
      duplicateTransactions,
      nearMatchTransactions,
      action,
      message,
    };
  }

  /**
   * Manual similarity check when database functions are unavailable
   */
  private async manualSimilarityCheck(
    newTransactions: Transaction[],
    userId: string
  ): Promise<SimilarityResult> {
    // Get all existing transactions for user
    const { data: existingTransactions, error } = await this.supabase
      .from('categorized_transactions')
      .select(`
        id,
        job_id,
        original_description,
        amount,
        date,
        transaction_fingerprint
      `)
      .eq('job.user_id', userId)
      .limit(10000);

    if (error) {
      console.error('Error fetching existing transactions:', error);
      return {
        similarityScore: 0,
        totalNewTransactions: newTransactions.length,
        matchingCount: 0,
        existingJobId: null,
        existingJobIds: [],
        newTransactions: newTransactions,
        duplicateTransactions: [],
        nearMatchTransactions: [],
        action: 'proceed',
        message: 'Could not check for duplicates, proceeding with insert.',
      };
    }

    // Build fingerprint set from existing transactions
    const existingFingerprints = new Set<string>();
    const fingerprintToJobId = new Map<string, string>();

    for (const tx of existingTransactions || []) {
      const fp = tx.transaction_fingerprint || generateTransactionFingerprint(
        tx.original_description,
        tx.amount,
        tx.date
      );
      existingFingerprints.add(fp);
      fingerprintToJobId.set(fp, tx.job_id);
    }

    // Check new transactions against existing
    const duplicateTransactions: Transaction[] = [];
    const newTransactionsToInsert: Transaction[] = [];
    const jobMatchCounts = new Map<string, number>();

    for (const tx of newTransactions) {
      const dateStr = typeof tx.date === 'string' 
        ? tx.date 
        : tx.date?.toISOString().split('T')[0] || '';
      
      const fingerprint = generateTransactionFingerprint(
        tx.original_description,
        tx.amount,
        dateStr
      );

      if (existingFingerprints.has(fingerprint)) {
        duplicateTransactions.push({
          ...tx,
          transaction_fingerprint: fingerprint,
        });
        
        const jobId = fingerprintToJobId.get(fingerprint);
        if (jobId) {
          jobMatchCounts.set(jobId, (jobMatchCounts.get(jobId) || 0) + 1);
        }
      } else {
        newTransactionsToInsert.push({
          ...tx,
          transaction_fingerprint: fingerprint,
        });
      }
    }

    const sortedJobs = [...jobMatchCounts.entries()]
      .sort((a, b) => b[1] - a[1]);

    const matchingCount = duplicateTransactions.length;
    const similarityScore = (matchingCount / newTransactions.length) * 100;

    let action: 'reject' | 'merge' | 'proceed';
    let message: string;

    if (similarityScore >= this.options.similarityThreshold) {
      action = 'merge';
      message = `${similarityScore.toFixed(1)}% of transactions already exist.`;
    } else if (similarityScore >= PARTIAL_SIMILARITY_THRESHOLD) {
      action = 'merge';
      message = `${similarityScore.toFixed(1)}% overlap detected.`;
    } else {
      action = 'proceed';
      message = `Low similarity (${similarityScore.toFixed(1)}%).`;
    }

    return {
      similarityScore,
      totalNewTransactions: newTransactions.length,
      matchingCount,
      existingJobId: sortedJobs.length > 0 ? sortedJobs[0][0] : null,
      existingJobIds: sortedJobs.map(j => j[0]),
      newTransactions: newTransactionsToInsert,
      duplicateTransactions,
      nearMatchTransactions: [],
      action,
      message,
    };
  }

  /**
   * Find near-matches for transactions that aren't exact duplicates
   */
  private async findNearMatches(
    transactions: Transaction[],
    userId: string
  ): Promise<NearMatch[]> {
    const nearMatches: NearMatch[] = [];

    // Get recent transactions for comparison
    // Only check last 90 days to limit scope
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: recentTransactions, error } = await this.supabase
      .from('categorized_transactions')
      .select(`
        id,
        job_id,
        original_description,
        amount,
        date,
        transaction_fingerprint,
        job:categorization_jobs!inner(user_id)
      `)
      .eq('job.user_id', userId)
      .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
      .limit(5000);

    if (error || !recentTransactions) {
      return nearMatches;
    }

    // Check each new transaction for near-matches
    for (const newTx of transactions) {
      for (const existingTx of recentTransactions) {
        const result = areTransactionsNearMatch(
          newTx,
          existingTx as unknown as Transaction,
          this.options.nearMatchThresholds
        );

        if (result.isNearMatch) {
          nearMatches.push({
            incoming: newTx,
            existing: existingTx as unknown as Transaction,
            matchType: result.matchType!,
            difference: result.difference!,
          });
          break; // Only report first near-match for each new transaction
        }
      }
    }

    return nearMatches;
  }

  /**
   * Quick check if an upload is likely a duplicate (fast path)
   */
  async isLikelyDuplicate(
    transactionCount: number,
    sampleTransactions: Transaction[],
    userId: string
  ): Promise<{ isDuplicate: boolean; confidence: number }> {
    // Check a sample of transactions
    const sampleFingerprints = extractFingerprints(sampleTransactions);

    const { data: matchResult } = await this.supabase.rpc(
      'calculate_fingerprint_similarity',
      {
        p_user_id: userId,
        p_new_fingerprints: sampleFingerprints,
      }
    ) as { data: Array<{ similarity_percentage: number }> | null };

    const similarity = matchResult?.[0]?.similarity_percentage || 0;

    return {
      isDuplicate: similarity >= this.options.similarityThreshold,
      confidence: similarity,
    };
  }
}

/**
 * Factory function for creating a duplicate detector
 */
export function createDuplicateDetector(
  supabase: SupabaseClient,
  options?: DuplicateDetectorOptions
): SpreadsheetDuplicateDetector {
  return new SpreadsheetDuplicateDetector(supabase, options);
}
