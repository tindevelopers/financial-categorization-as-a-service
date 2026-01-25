import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';

/**
 * GET /api/reconciliation/unreconciled
 * Returns unreconciled invoices and transactions with match suggestions
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get unreconciled invoices (invoices without matching transactions)
    const { data: invoices, error: invoicesError } = await supabase
      .from('financial_documents')
      .select('*')
      .eq('user_id', user.id)
      .eq('file_type', 'invoice')
      .eq('reconciliation_status', 'unreconciled')
      .is('matched_transaction_id', null)
      .order('document_date', { ascending: false });

    if (invoicesError) {
      console.error('Error fetching unreconciled invoices:', invoicesError);
      return NextResponse.json(
        { error: 'Failed to fetch unreconciled invoices' },
        { status: 500 }
      );
    }

    // Get unreconciled transactions (transactions without matching invoices/documents)
    const { data: transactions, error: transactionsError } = await supabase
      .from('categorized_transactions')
      .select(`
        *,
        job:categorization_jobs!inner(
          id,
          user_id
        )
      `)
      .eq('job.user_id', user.id)
      .eq('reconciliation_status', 'unreconciled')
      .is('matched_document_id', null)
      .order('date', { ascending: false });

    if (transactionsError) {
      console.error('Error fetching unreconciled transactions:', transactionsError);
      return NextResponse.json(
        { error: 'Failed to fetch unreconciled transactions' },
        { status: 500 }
      );
    }

    // For each invoice, find potential transaction matches
    const invoicesWithMatches = await Promise.all(
      (invoices || []).map(async (invoice) => {
        const potentialMatches = await findPotentialMatches(
          invoice,
          transactions || [],
          supabase,
          'transaction'
        );
        return {
          ...invoice,
          invoice_number: invoice.document_number, // Map document_number to invoice_number for UI compatibility
          potential_matches: potentialMatches,
        };
      })
    );

    // For each transaction, find potential invoice/document matches
    const transactionsWithMatches = await Promise.all(
      (transactions || []).map(async (transaction) => {
        const potentialMatches = await findPotentialMatches(
          transaction,
          invoices || [],
          supabase,
          'document'
        );
        return {
          ...transaction,
          potential_matches: potentialMatches,
        };
      })
    );

    return NextResponse.json({
      success: true,
      invoices: {
        items: invoicesWithMatches,
        count: invoicesWithMatches.length,
      },
      transactions: {
        items: transactionsWithMatches,
        count: transactionsWithMatches.length,
      },
      summary: {
        total_unreconciled: invoicesWithMatches.length + transactionsWithMatches.length,
        invoices_count: invoicesWithMatches.length,
        transactions_count: transactionsWithMatches.length,
      },
    });
  } catch (error) {
    console.error('Unreconciled items error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Find potential matches for an item (invoice or transaction)
 */
async function findPotentialMatches(
  item: any,
  candidates: any[],
  supabase: any,
  candidateType: 'transaction' | 'document'
): Promise<Array<{
  id: string;
  description: string;
  amount: number;
  date: string;
  confidence: 'high' | 'medium' | 'low';
  score: number;
  amount_diff: number;
  days_diff: number;
}>> {
  const matches: Array<{
    id: string;
    description: string;
    amount: number;
    date: string;
    confidence: 'high' | 'medium' | 'low';
    score: number;
    amount_diff: number;
    days_diff: number;
  }> = [];

  const itemAmount = item.total_amount || item.amount || 0;
  const itemDate = item.document_date || item.date;

  for (const candidate of candidates) {
    // Skip if already matched
    if (candidateType === 'transaction' && candidate.matched_document_id) continue;
    if (candidateType === 'document' && candidate.matched_transaction_id) continue;

    const candidateAmount = candidate.total_amount || candidate.amount || 0;
    const candidateDate = candidate.document_date || candidate.date;

    // Compare absolute amounts - transactions are negative, documents are positive
    const amountDiff = Math.abs(Math.abs(itemAmount) - Math.abs(candidateAmount));
    const dateDiff = itemDate && candidateDate
      ? Math.abs(
          (new Date(itemDate).getTime() - new Date(candidateDate).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 999;

    // Only consider reasonable matches
    if (amountDiff >= 100 || dateDiff > 60) continue;

    // Calculate match score
    const amountScore = Math.max(0, 100 - amountDiff * 10);
    const dateScore = Math.max(0, 100 - dateDiff * 2);
    const descriptionScore = calculateDescriptionMatch(
      item.vendor_name || item.original_description,
      candidate.vendor_name || candidate.original_description
    );

    const totalScore = amountScore * 0.5 + dateScore * 0.3 + descriptionScore * 0.2;

    // Determine confidence level
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (amountDiff < 0.01 && dateDiff <= 7 && totalScore >= 80) {
      confidence = 'high';
    } else if (amountDiff < 1.00 && dateDiff <= 30 && totalScore >= 60) {
      confidence = 'medium';
    }

    matches.push({
      id: candidate.id,
      description: candidate.vendor_name || candidate.original_description || 'Unknown',
      amount: candidateAmount,
      date: candidateDate || '',
      confidence,
      score: totalScore,
      amount_diff: amountDiff,
      days_diff: dateDiff,
    });
  }

  // Sort by score descending and return top 5
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// Helper function to calculate description similarity
function calculateDescriptionMatch(description: string, vendor: string): number {
  if (!description || !vendor) return 0;
  
  const desc = description.toLowerCase();
  const vend = vendor.toLowerCase();
  
  // Check if vendor name appears in description
  if (desc.includes(vend) || vend.includes(desc)) {
    return 100;
  }
  
  // Check for word overlap
  const descWords = desc.split(/\s+/).filter(w => w.length > 3);
  const vendWords = vend.split(/\s+/).filter(w => w.length > 3);
  
  let matchCount = 0;
  for (const dw of descWords) {
    for (const vw of vendWords) {
      if (dw.includes(vw) || vw.includes(dw)) {
        matchCount++;
      }
    }
  }
  
  const maxWords = Math.max(descWords.length, vendWords.length);
  if (maxWords === 0) return 0;
  
  return (matchCount / maxWords) * 100;
}

