/**
 * Bank Statement Processor
 * 
 * Enhanced processing for bank statements with support for:
 * - Opening/closing balances
 * - Transaction type classification (debit/credit/interest/fee)
 * - Reference numbers
 * - Posted dates vs transaction dates
 * - Balance validation
 */

import { processBankStatementOCR, BankStatementData, BankStatementTransaction } from './bank-statement-ocr';

export interface StatementMetadata {
  account_number?: string;
  account_holder?: string;
  statement_number?: string;
  period_start: Date;
  period_end: Date;
  opening_balance: number;
  closing_balance: number;
  currency: string;
  transaction_count: number;
  total_debits: number;
  total_credits: number;
}

export interface EnhancedTransaction {
  date: Date;
  posted_date?: Date;
  description: string;
  amount: number;
  transaction_type: 'debit' | 'credit' | 'interest' | 'fee' | 'transfer' | 'deposit' | 'withdrawal' | 'payment' | 'refund';
  is_debit: boolean;
  reference_number?: string;
  merchant_category_code?: string;
  running_balance?: number;
}

export interface ProcessedBankStatement {
  metadata: StatementMetadata;
  transactions: EnhancedTransaction[];
  extracted_text?: string;
  confidence_score?: number;
}

/**
 * Extract statement metadata from OCR results
 */
export function extractStatementMetadata(
  ocrData: BankStatementData,
  extractedText?: string
): StatementMetadata {
  const metadata: StatementMetadata = {
    period_start: ocrData.statement_period_start 
      ? new Date(ocrData.statement_period_start) 
      : new Date(),
    period_end: ocrData.statement_period_end 
      ? new Date(ocrData.statement_period_end) 
      : new Date(),
    opening_balance: ocrData.opening_balance || 0,
    closing_balance: ocrData.closing_balance || 0,
    currency: 'GBP', // Default to GBP, can be extracted from OCR
    transaction_count: ocrData.transactions.length,
    total_debits: 0,
    total_credits: 0,
  };

  // Extract account number if available
  if (ocrData.account_number) {
    metadata.account_number = ocrData.account_number;
  }

  // Extract account holder if available
  if (ocrData.account_holder) {
    metadata.account_holder = ocrData.account_holder;
  }

  // Try to extract statement number from text
  if (extractedText) {
    const statementNumberMatch = extractedText.match(/statement\s*(?:number|no|#)?\s*:?\s*([A-Z0-9-]+)/i);
    if (statementNumberMatch) {
      metadata.statement_number = statementNumberMatch[1];
    }
  }

  // Calculate totals from transactions
  ocrData.transactions.forEach(tx => {
    if (tx.type === 'debit' || (tx.amount < 0 && !tx.type)) {
      metadata.total_debits += Math.abs(tx.amount);
    } else {
      metadata.total_credits += Math.abs(tx.amount);
    }
  });

  return metadata;
}

/**
 * Classify transaction type based on description and amount
 */
export function classifyTransactionType(
  description: string,
  amount: number,
  existingType?: 'debit' | 'credit'
): 'debit' | 'credit' | 'interest' | 'fee' | 'transfer' | 'deposit' | 'withdrawal' | 'payment' | 'refund' {
  const descLower = description.toLowerCase();

  // Interest payments/receipts
  if (descLower.includes('interest') || descLower.includes('int ')) {
    return amount > 0 ? 'interest' : 'interest';
  }

  // Fees
  if (
    descLower.includes('fee') ||
    descLower.includes('charge') ||
    descLower.includes('overdraft') ||
    descLower.includes('maintenance') ||
    descLower.includes('service charge')
  ) {
    return 'fee';
  }

  // Refunds
  if (
    descLower.includes('refund') ||
    descLower.includes('reversal') ||
    descLower.includes('chargeback')
  ) {
    return 'refund';
  }

  // Transfers
  if (
    descLower.includes('transfer') ||
    descLower.includes('internal transfer') ||
    descLower.includes('online transfer')
  ) {
    return 'transfer';
  }

  // Deposits
  if (
    descLower.includes('deposit') ||
    descLower.includes('credit') ||
    descLower.includes('payment received')
  ) {
    return 'deposit';
  }

  // Withdrawals
  if (
    descLower.includes('withdrawal') ||
    descLower.includes('cash withdrawal') ||
    descLower.includes('atm')
  ) {
    return 'withdrawal';
  }

  // Payments
  if (
    descLower.includes('payment') ||
    descLower.includes('direct debit') ||
    descLower.includes('standing order') ||
    descLower.includes('card payment')
  ) {
    return 'payment';
  }

  // Default based on existing type or amount sign
  if (existingType) {
    return existingType === 'debit' ? 'debit' : 'credit';
  }

  return amount < 0 ? 'debit' : 'credit';
}

/**
 * Normalize transaction amount based on type
 * Ensures amounts are positive with is_debit flag indicating direction
 */
export function normalizeTransactionAmount(
  amount: number,
  transactionType: 'debit' | 'credit' | 'interest' | 'fee' | 'transfer' | 'deposit' | 'withdrawal' | 'payment' | 'refund'
): { amount: number; is_debit: boolean } {
  // Debits reduce account balance (money out)
  const debitTypes: Array<typeof transactionType> = ['debit', 'withdrawal', 'payment', 'fee'];
  
  // Credits increase account balance (money in)
  const creditTypes: Array<typeof transactionType> = ['credit', 'deposit', 'refund', 'interest'];

  let is_debit: boolean;
  let normalizedAmount: number;

  if (debitTypes.includes(transactionType)) {
    is_debit = true;
    normalizedAmount = Math.abs(amount);
  } else if (creditTypes.includes(transactionType)) {
    is_debit = false;
    normalizedAmount = Math.abs(amount);
  } else {
    // Transfer - determine based on amount sign
    is_debit = amount < 0;
    normalizedAmount = Math.abs(amount);
  }

  return { amount: normalizedAmount, is_debit };
}

/**
 * Extract reference number from transaction description
 */
export function extractReferenceNumber(description: string): string | undefined {
  // Common patterns for reference numbers
  const patterns = [
    /ref[:\s]+([A-Z0-9-]+)/i,
    /reference[:\s]+([A-Z0-9-]+)/i,
    /ref\s+no[:\s]+([A-Z0-9-]+)/i,
    /check\s+no[:\s]+([0-9]+)/i,
    /chq\s+no[:\s]+([0-9]+)/i,
    /transaction\s+id[:\s]+([A-Z0-9-]+)/i,
    /txn[:\s]+([A-Z0-9-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return undefined;
}

/**
 * Extract posted date from transaction (may differ from transaction date)
 */
export function extractPostedDate(description: string, transactionDate: Date): Date | undefined {
  // Look for posted date patterns in description
  const postedPatterns = [
    /posted[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /cleared[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  ];

  for (const pattern of postedPatterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      const postedDate = new Date(match[1]);
      if (!isNaN(postedDate.getTime())) {
        return postedDate;
      }
    }
  }

  return undefined;
}

/**
 * Calculate running balance for transactions
 */
export function calculateRunningBalances(
  transactions: EnhancedTransaction[],
  openingBalance: number
): EnhancedTransaction[] {
  let runningBalance = openingBalance;

  return transactions.map(tx => {
    if (tx.is_debit) {
      runningBalance -= tx.amount;
    } else {
      runningBalance += tx.amount;
    }

    return {
      ...tx,
      running_balance: runningBalance,
    };
  });
}

/**
 * Validate statement balances
 * Returns true if opening balance + transactions = closing balance (within tolerance)
 */
export function validateStatementBalances(
  openingBalance: number,
  closingBalance: number,
  transactions: EnhancedTransaction[],
  tolerance: number = 0.01
): { valid: boolean; calculatedClosingBalance: number; difference: number } {
  let calculatedBalance = openingBalance;

  transactions.forEach(tx => {
    if (tx.is_debit) {
      calculatedBalance -= tx.amount;
    } else {
      calculatedBalance += tx.amount;
    }
  });

  const difference = Math.abs(calculatedBalance - closingBalance);
  const valid = difference <= tolerance;

  return {
    valid,
    calculatedClosingBalance: calculatedBalance,
    difference,
  };
}

/**
 * Process bank statement with enhanced extraction
 */
export async function processBankStatement(
  fileData: Blob,
  filename: string
): Promise<ProcessedBankStatement> {
  // Use existing OCR function
  const ocrData = await processBankStatementOCR(fileData, filename);

  // Extract metadata
  const metadata = extractStatementMetadata(ocrData, ocrData.extracted_text);

  // Enhance transactions
  const enhancedTransactions: EnhancedTransaction[] = ocrData.transactions.map(tx => {
    const transactionType = classifyTransactionType(
      tx.description,
      tx.amount,
      tx.type
    );

    const { amount, is_debit } = normalizeTransactionAmount(tx.amount, transactionType);

    const enhanced: EnhancedTransaction = {
      date: new Date(tx.date),
      description: tx.description,
      amount,
      transaction_type: transactionType,
      is_debit,
      reference_number: extractReferenceNumber(tx.description),
      running_balance: tx.balance,
    };

    // Extract posted date if available
    const postedDate = extractPostedDate(tx.description, enhanced.date);
    if (postedDate) {
      enhanced.posted_date = postedDate;
    }

    return enhanced;
  });

  // Calculate running balances if not provided
  if (enhancedTransactions.some(tx => !tx.running_balance)) {
    const withBalances = calculateRunningBalances(
      enhancedTransactions,
      metadata.opening_balance
    );
    
    // Update closing balance if calculated balance differs significantly
    const validation = validateStatementBalances(
      metadata.opening_balance,
      metadata.closing_balance,
      withBalances
    );

    if (!validation.valid) {
      console.warn('Statement balance validation failed:', {
        expected: metadata.closing_balance,
        calculated: validation.calculatedClosingBalance,
        difference: validation.difference,
      });
    }

    return {
      metadata: {
        ...metadata,
        closing_balance: validation.valid 
          ? metadata.closing_balance 
          : validation.calculatedClosingBalance,
      },
      transactions: withBalances,
      extracted_text: ocrData.extracted_text,
      confidence_score: ocrData.confidence_score,
    };
  }

  return {
    metadata,
    transactions: enhancedTransactions,
    extracted_text: ocrData.extracted_text,
    confidence_score: ocrData.confidence_score,
  };
}

