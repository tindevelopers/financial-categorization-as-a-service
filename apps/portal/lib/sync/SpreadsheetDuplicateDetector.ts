/**
 * Spreadsheet Duplicate Detector
 * Simplified version for portal app
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Transaction, SimilarityResult } from './types';
import { generateTransactionFingerprint } from './fingerprint';

export interface DuplicateDetectorOptions {
  similarityThreshold?: number;
  checkNearMatches?: boolean;
}

export class SpreadsheetDuplicateDetector {
  private supabase: SupabaseClient;
  private options: {
    similarityThreshold: number;
    checkNearMatches: boolean;
  };

  constructor(
    supabase: SupabaseClient,
    options?: DuplicateDetectorOptions
  ) {
    this.supabase = supabase;
    this.options = {
      similarityThreshold: options?.similarityThreshold ?? 95,
      checkNearMatches: options?.checkNearMatches ?? true,
    };
  }

  /**
   * Detect similarity between new transactions and existing ones
   */
  async detectSimilarity(
    newTransactions: Transaction[],
    userId: string
  ): Promise<SimilarityResult> {
    if (newTransactions.length === 0) {
      return {
        similarityScore: 0,
        totalNewTransactions: 0,
        matchingCount: 0,
        existingJobId: null,
        existingJobIds: [],
        newTransactions: [],
        duplicateTransactions: [],
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

    // Get existing transactions for this user
    const { data: existingTransactions } = await this.supabase
      .from('categorized_transactions')
      .select('id, transaction_fingerprint, job_id, original_description, amount, date')
      .eq('user_id', userId)
      .not('transaction_fingerprint', 'is', null);

    if (!existingTransactions || existingTransactions.length === 0) {
      return {
        similarityScore: 0,
        totalNewTransactions: newTransactions.length,
        matchingCount: 0,
        existingJobId: null,
        existingJobIds: [],
        newTransactions,
        duplicateTransactions: [],
      };
    }

    // Create a map of existing fingerprints
    const existingFingerprintMap = new Map<string, typeof existingTransactions>();
    existingTransactions.forEach(tx => {
      if (tx.transaction_fingerprint) {
        if (!existingFingerprintMap.has(tx.transaction_fingerprint)) {
          existingFingerprintMap.set(tx.transaction_fingerprint, []);
        }
        existingFingerprintMap.get(tx.transaction_fingerprint)!.push(tx);
      }
    });

    // Find duplicates
    const duplicateTransactions: Transaction[] = [];
    const newTransactionsToInsert: Transaction[] = [];
    const matchingJobIds = new Set<string>();

    newFingerprints.forEach(({ transaction, fingerprint }) => {
      const existing = existingFingerprintMap.get(fingerprint);
      if (existing && existing.length > 0) {
        duplicateTransactions.push(transaction);
        existing.forEach(tx => {
          if (tx.job_id) {
            matchingJobIds.add(tx.job_id);
          }
        });
      } else {
        newTransactionsToInsert.push(transaction);
      }
    });

    // Calculate similarity score
    const matchingCount = duplicateTransactions.length;
    const totalCount = newTransactions.length;
    const similarityScore = totalCount > 0 
      ? Math.round((matchingCount / totalCount) * 100) 
      : 0;

    // Get the most common job ID
    const jobIdCounts = new Map<string, number>();
    existingTransactions.forEach(tx => {
      if (tx.job_id) {
        jobIdCounts.set(tx.job_id, (jobIdCounts.get(tx.job_id) || 0) + 1);
      }
    });

    let existingJobId: string | null = null;
    let maxCount = 0;
    jobIdCounts.forEach((count, jobId) => {
      if (count > maxCount) {
        maxCount = count;
        existingJobId = jobId;
      }
    });

    return {
      similarityScore,
      totalNewTransactions: totalCount,
      matchingCount,
      existingJobId,
      existingJobIds: Array.from(matchingJobIds),
      newTransactions: newTransactionsToInsert,
      duplicateTransactions,
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

