/**
 * Transaction Fingerprinting Utilities
 */

import crypto from 'crypto';
import type { Transaction } from './types';

/**
 * Generate a fingerprint for a transaction based on description, amount, and date
 */
export function generateTransactionFingerprint(
  transaction: Transaction
): string;
export function generateTransactionFingerprint(
  description: string,
  amount: number,
  date: string | Date
): string;
export function generateTransactionFingerprint(
  transactionOrDescription: Transaction | string,
  amount?: number,
  date?: string | Date
): string {
  let description: string;
  let txAmount: number;
  let txDate: string | Date;

  if (typeof transactionOrDescription === 'object') {
    // Called with Transaction object
    description = transactionOrDescription.original_description || '';
    txAmount = transactionOrDescription.amount || 0;
    txDate = transactionOrDescription.date || new Date();
  } else {
    // Called with individual parameters
    description = transactionOrDescription || '';
    txAmount = amount || 0;
    txDate = date || new Date();
  }

  // Normalize values
  const normalizedDescription = description.toLowerCase().trim();
  const normalizedAmount = txAmount.toString();
  const normalizedDate = typeof txDate === 'string' 
    ? txDate 
    : txDate?.toISOString().split('T')[0] || '';

  const input = `${normalizedDescription}|${normalizedAmount}|${normalizedDate}`;
  
  return crypto.createHash('sha256').update(input).digest('hex');
}

