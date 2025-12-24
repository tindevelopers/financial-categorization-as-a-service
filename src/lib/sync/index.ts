/**
 * Sync Library - Bidirectional synchronization between database and external sources
 */

// Types
export * from './types';

// Fingerprint utilities
export {
  generateTransactionFingerprint,
  generateFingerprints,
  extractFingerprints,
  calculateStringSimilarity,
  areTransactionsNearMatch,
} from './fingerprint';

// Duplicate detection
export {
  SpreadsheetDuplicateDetector,
  createDuplicateDetector,
  type DuplicateDetectorOptions,
} from './SpreadsheetDuplicateDetector';

// Merge algorithm
export {
  TransactionMerger,
  createTransactionMerger,
  type MergerOptions,
  type MergeContext,
} from './TransactionMerger';

// Google Sheets sync
export {
  GoogleSheetsSyncService,
  createGoogleSheetsSyncService,
  type GoogleSheetsSyncOptions,
} from './GoogleSheetsSyncService';
