/**
 * Transaction Fingerprinting Utilities
 * Generates consistent hashes for transaction deduplication
 */

import crypto from 'crypto';
import { Transaction } from './types';

/**
 * Generate a fingerprint for a transaction based on description, amount, and date
 * This must match the database function generate_transaction_fingerprint
 */
export function generateTransactionFingerprint(
  description: string,
  amount: number,
  date: string | Date
): string {
  // Normalize values to match database function
  const normalizedDescription = (description || '').toLowerCase().trim();
  const normalizedAmount = amount?.toString() || '0';
  const normalizedDate = typeof date === 'string' 
    ? date 
    : date?.toISOString().split('T')[0] || '';

  const input = `${normalizedDescription}|${normalizedAmount}|${normalizedDate}`;
  
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Generate fingerprints for an array of transactions
 */
export function generateFingerprints(transactions: Transaction[]): Map<string, Transaction> {
  const fingerprintMap = new Map<string, Transaction>();
  
  for (const tx of transactions) {
    const dateStr = typeof tx.date === 'string' 
      ? tx.date 
      : tx.date?.toISOString().split('T')[0] || '';
    
    const fingerprint = generateTransactionFingerprint(
      tx.original_description,
      tx.amount,
      dateStr
    );
    
    fingerprintMap.set(fingerprint, {
      ...tx,
      transaction_fingerprint: fingerprint
    });
  }
  
  return fingerprintMap;
}

/**
 * Get all fingerprints from an array of transactions
 */
export function extractFingerprints(transactions: Transaction[]): string[] {
  return transactions.map(tx => {
    if (tx.transaction_fingerprint) {
      return tx.transaction_fingerprint;
    }
    
    const dateStr = typeof tx.date === 'string' 
      ? tx.date 
      : tx.date?.toISOString().split('T')[0] || '';
    
    return generateTransactionFingerprint(
      tx.original_description,
      tx.amount,
      dateStr
    );
  });
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = (str1 || '').toLowerCase().trim();
  const s2 = (str2 || '').toLowerCase().trim();
  
  if (s1 === s2) return 100;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Use Levenshtein distance
  const matrix: number[][] = [];
  
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  const distance = matrix[s1.length][s2.length];
  const maxLength = Math.max(s1.length, s2.length);
  
  return Math.round(((maxLength - distance) / maxLength) * 100);
}

/**
 * Check if two transactions are near-matches (similar but not identical)
 */
export function areTransactionsNearMatch(
  tx1: Transaction,
  tx2: Transaction,
  thresholds = {
    amountDiffPercent: 1,     // 1% difference allowed
    dateDiffDays: 3,           // 3 days difference allowed
    descriptionSimilarity: 80  // 80% similarity required
  }
): {
  isNearMatch: boolean;
  matchType?: 'amount_diff' | 'date_diff' | 'description_diff';
  difference?: {
    amountDiff?: number;
    dateDiff?: number;
    descriptionSimilarity?: number;
  };
} {
  const desc1 = (tx1.original_description || '').toLowerCase().trim();
  const desc2 = (tx2.original_description || '').toLowerCase().trim();
  const descSimilarity = calculateStringSimilarity(desc1, desc2);
  
  const date1 = new Date(tx1.date);
  const date2 = new Date(tx2.date);
  const dateDiffDays = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
  
  const amount1 = tx1.amount || 0;
  const amount2 = tx2.amount || 0;
  const amountDiff = Math.abs(amount1 - amount2);
  const amountDiffPercent = amount1 !== 0 
    ? (amountDiff / Math.abs(amount1)) * 100 
    : (amount2 !== 0 ? 100 : 0);
  
  // Check for near-matches
  const exactAmountAndDate = amountDiff < 0.01 && dateDiffDays < 1;
  const similarDescription = descSimilarity >= thresholds.descriptionSimilarity;
  
  // Same amount and date but different description
  if (exactAmountAndDate && !similarDescription && descSimilarity >= 50) {
    return {
      isNearMatch: true,
      matchType: 'description_diff',
      difference: { descriptionSimilarity }
    };
  }
  
  // Same description and date but slightly different amount
  if (similarDescription && dateDiffDays < 1 && amountDiffPercent <= thresholds.amountDiffPercent) {
    return {
      isNearMatch: true,
      matchType: 'amount_diff',
      difference: { amountDiff }
    };
  }
  
  // Same description and amount but different date within threshold
  if (similarDescription && amountDiff < 0.01 && dateDiffDays <= thresholds.dateDiffDays) {
    return {
      isNearMatch: true,
      matchType: 'date_diff',
      difference: { dateDiff: dateDiffDays }
    };
  }
  
  return { isNearMatch: false };
}
