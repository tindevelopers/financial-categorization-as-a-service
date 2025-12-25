/**
 * Transaction Fingerprinting Utilities
 */

import crypto from 'crypto';
import type { Transaction } from './types';

/**
 * Generate a fingerprint for a transaction based on description, amount, and date
 */
export function generateTransactionFingerprint(
  description: string,
  amount: number,
  date: string | Date
): string {
  // Normalize values
  const normalizedDescription = (description || '').toLowerCase().trim();
  const normalizedAmount = amount?.toString() || '0';
  const normalizedDate = typeof date === 'string' 
    ? date 
    : date?.toISOString().split('T')[0] || '';

  const input = `${normalizedDescription}|${normalizedAmount}|${normalizedDate}`;
  
  return crypto.createHash('sha256').update(input).digest('hex');
}

