import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/core/database/server';

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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'unreconciled';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get unreconciled transactions with potential matches
    const { data: transactions, error: txError } = await supabase
      .from('categorized_transactions')
      .select(`
        *,
        job:categorization_jobs!inner(
          id,
          original_filename,
          created_at
        )
      `)
      .eq('job.user_id', user.id)
      .eq('reconciliation_status', status)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    // Get unreconciled documents
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .eq('reconciliation_status', 'unreconciled')
      .order('invoice_date', { ascending: false });

    if (docError) {
      console.error('Error fetching documents:', docError);
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    // Find potential matches for each transaction
    const transactionsWithMatches = transactions.map(tx => {
      const potentialMatches = documents
        .filter(doc => {
          const amountDiff = Math.abs((tx.amount || 0) - (doc.total_amount || 0));
          const dateDiff = doc.invoice_date 
            ? Math.abs(
                (new Date(tx.date).getTime() - new Date(doc.invoice_date).getTime()) / 
                (1000 * 60 * 60 * 24)
              )
            : 999;
          
          // Only show matches within reasonable thresholds
          return amountDiff < 100 && dateDiff <= 60;
        })
        .map(doc => {
          const amountDiff = Math.abs((tx.amount || 0) - (doc.total_amount || 0));
          const dateDiff = doc.invoice_date
            ? Math.abs(
                (new Date(tx.date).getTime() - new Date(doc.invoice_date).getTime()) / 
                (1000 * 60 * 60 * 24)
              )
            : 999;
          
          // Calculate match confidence
          let matchConfidence: 'high' | 'medium' | 'low' = 'low';
          if (amountDiff < 0.01 && dateDiff <= 7) {
            matchConfidence = 'high';
          } else if (amountDiff < 1.00 && dateDiff <= 30) {
            matchConfidence = 'medium';
          }
          
          return {
            ...doc,
            match_confidence: matchConfidence,
            amount_difference: amountDiff,
            days_difference: dateDiff,
          };
        })
        .sort((a, b) => {
          // Sort by confidence, then by amount difference
          const confidenceScore = { high: 3, medium: 2, low: 1 };
          const aScore = confidenceScore[a.match_confidence];
          const bScore = confidenceScore[b.match_confidence];
          
          if (aScore !== bScore) return bScore - aScore;
          return a.amount_difference - b.amount_difference;
        })
        .slice(0, 5); // Top 5 matches per transaction

      return {
        ...tx,
        potential_matches: potentialMatches,
      };
    });

    // Get summary stats
    const { count: totalUnreconciled } = await supabase
      .from('categorized_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('reconciliation_status', 'unreconciled')
      .in('job_id', transactions.map(t => t.job_id));

    const { count: totalMatched } = await supabase
      .from('categorized_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('reconciliation_status', 'matched')
      .in('job_id', transactions.map(t => t.job_id));

    return NextResponse.json({
      transactions: transactionsWithMatches,
      summary: {
        total_unreconciled: totalUnreconciled || 0,
        total_matched: totalMatched || 0,
        total_documents: documents.length,
      },
    });
  } catch (error) {
    console.error('Reconciliation candidates error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

