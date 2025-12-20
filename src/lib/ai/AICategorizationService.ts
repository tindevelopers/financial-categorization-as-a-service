/**
 * AI Categorization Service Interface
 * 
 * Abstraction layer for AI-powered transaction categorization
 * Supports multiple providers (Vercel AI Gateway, Abacus.ai, etc.)
 */

export interface Transaction {
  id?: string;
  original_description: string;
  amount: number;
  date: string;
  category?: string | null;
  subcategory?: string | null;
  confidence_score?: number | null;
}

export interface CategoryResult {
  category: string;
  subcategory?: string;
  confidenceScore: number;
  reasoning?: string;
}

export interface AICategorizationService {
  /**
   * Categorize a single transaction
   */
  categorizeTransaction(transaction: Transaction): Promise<CategoryResult>;

  /**
   * Categorize multiple transactions (batch processing)
   */
  categorizeBatch(transactions: Transaction[]): Promise<CategoryResult[]>;

  /**
   * Get confidence score from a categorization result
   */
  getConfidenceScore(result: CategoryResult): number;

  /**
   * Get provider name
   */
  getProviderName(): string;
}
