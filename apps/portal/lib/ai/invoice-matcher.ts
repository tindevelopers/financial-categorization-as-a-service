/**
 * Invoice-to-Transaction AI Matching Algorithm
 * 
 * Matches invoices to bank transactions using multiple factors:
 * - Amount matching (40% weight)
 * - Date proximity (30% weight)
 * - Vendor name similarity (20% weight)
 * - Bank account context (10% weight)
 */

interface Transaction {
  id: string;
  date: Date | string;
  amount: number;
  original_description: string;
  bank_account_id?: string | null;
}

interface Invoice {
  id: string;
  total_amount: number | null;
  document_date: Date | string | null;
  vendor_name: string | null;
  bank_account_id?: string | null;
}

interface Match {
  transaction_id: string;
  transaction_date: Date | string;
  transaction_amount: number;
  transaction_description: string;
  bank_account_id: string | null;
  bank_account_name: string | null;
  match_score: number;
  amount_diff: number;
  date_diff_days: number | null;
  confidence_level: "high" | "medium" | "low";
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate match score between invoice and transaction
 */
function calculateMatchScore(
  invoice: Invoice,
  transaction: Transaction
): {
  score: number;
  amountDiff: number;
  dateDiffDays: number | null;
  vendorMatch: number;
} {
  const invoiceAmount = invoice.total_amount || 0;
  const transactionAmount = transaction.amount || 0;
  const amountDiff = Math.abs(transactionAmount - invoiceAmount);
  
  // Amount matching (40% weight)
  let amountScore = 0;
  if (amountDiff < 0.01) {
    amountScore = 40.0;
  } else if (amountDiff < 1.0) {
    amountScore = 30.0;
  } else if (amountDiff < 100.0) {
    amountScore = 20.0;
  }
  
  // Date proximity (30% weight)
  let dateScore = 0;
  let dateDiffDays: number | null = null;
  if (invoice.document_date && transaction.date) {
    const invoiceDate = new Date(invoice.document_date);
    const transactionDate = new Date(transaction.date);
    dateDiffDays = Math.abs(
      Math.floor((transactionDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    
    if (dateDiffDays <= 7) {
      dateScore = 30.0;
    } else if (dateDiffDays <= 30) {
      dateScore = 20.0;
    } else if (dateDiffDays <= 60) {
      dateScore = 10.0;
    }
  }
  
  // Vendor name similarity (20% weight)
  let vendorScore = 0;
  let vendorMatch = 0;
  if (invoice.vendor_name && transaction.original_description) {
    const description = transaction.original_description.toLowerCase();
    const vendor = invoice.vendor_name.toLowerCase();
    
    // Check if vendor name appears in description
    if (description.includes(vendor)) {
      vendorScore = 20.0;
      vendorMatch = 1.0;
    } else {
      // Calculate similarity
      vendorMatch = calculateStringSimilarity(description, vendor);
      if (vendorMatch >= 0.8) {
        vendorScore = 20.0;
      } else if (vendorMatch >= 0.6) {
        vendorScore = 15.0;
      } else if (vendorMatch >= 0.4) {
        vendorScore = 10.0;
      }
    }
  }
  
  // Bank account context (10% weight)
  let bankAccountScore = 0;
  if (invoice.bank_account_id && transaction.bank_account_id) {
    if (invoice.bank_account_id === transaction.bank_account_id) {
      bankAccountScore = 10.0;
    }
  }
  
  const totalScore = amountScore + dateScore + vendorScore + bankAccountScore;
  
  return {
    score: totalScore,
    amountDiff,
    dateDiffDays,
    vendorMatch,
  };
}

/**
 * Determine confidence level from match score
 */
function getConfidenceLevel(score: number, amountDiff: number, dateDiffDays: number | null, vendorMatch: number): "high" | "medium" | "low" {
  if (score >= 85 && amountDiff < 0.01 && (dateDiffDays === null || dateDiffDays <= 7) && vendorMatch >= 0.8) {
    return "high";
  }
  if (score >= 70 && amountDiff < 1.0 && (dateDiffDays === null || dateDiffDays <= 30) && vendorMatch >= 0.6) {
    return "medium";
  }
  if (score >= 50) {
    return "low";
  }
  return "low";
}

/**
 * Find best transaction matches for an invoice
 */
export async function findInvoiceMatches(
  invoice: Invoice,
  transactions: Transaction[],
  limit: number = 5
): Promise<Match[]> {
  const matches: Match[] = [];
  
  for (const transaction of transactions) {
    // Skip if transaction is already matched
    // (This would need to be checked in the database query)
    
    const { score, amountDiff, dateDiffDays, vendorMatch } = calculateMatchScore(invoice, transaction);
    
    // Only include matches with score >= 50
    if (score >= 50) {
      matches.push({
        transaction_id: transaction.id,
        transaction_date: transaction.date,
        transaction_amount: transaction.amount,
        transaction_description: transaction.original_description,
        bank_account_id: transaction.bank_account_id || null,
        bank_account_name: null, // Will be populated from database
        match_score: score,
        amount_diff: amountDiff,
        date_diff_days: dateDiffDays,
        confidence_level: getConfidenceLevel(score, amountDiff, dateDiffDays, vendorMatch),
      });
    }
  }
  
  // Sort by score descending and return top matches
  return matches
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, limit);
}

