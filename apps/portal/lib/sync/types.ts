/**
 * Types for the Sync System
 */

export interface Transaction {
  id?: string;
  job_id?: string;
  original_description: string;
  amount: number;
  date: string | Date;
  category?: string | null;
  subcategory?: string | null;
  confidence_score?: number;
  user_confirmed?: boolean;
  user_notes?: string | null;
  transaction_fingerprint?: string;
  source_type?: SourceType;
  source_identifier?: string | null;
  last_modified_source?: string | null;
  sync_version?: number;
  external_row_id?: string | null;
  last_synced_at?: string | null;
  reconciliation_status?: string;
  matched_document_id?: string | null;
}

export type SourceType = 'upload' | 'google_sheets' | 'manual' | 'api' | 'airtable';

export interface SimilarityResult {
  similarityScore: number;
  totalNewTransactions: number;
  matchingCount: number;
  existingJobId: string | null;
  existingJobIds: string[];
  newTransactions: Transaction[];
  duplicateTransactions: Transaction[];
}

