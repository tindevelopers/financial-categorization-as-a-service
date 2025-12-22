import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/core/database/server';

export async function POST(request: NextRequest) {
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

    // Check for active syncs - warn user if sync is in progress
    const { data: activeSyncs } = await supabase
      .from('sync_metadata')
      .select('id, source_name')
      .eq('user_id', user.id)
      .eq('sync_status', 'syncing');

    const hasSyncInProgress = (activeSyncs?.length || 0) > 0;

    // Check for pending conflicts that should be resolved first
    const { count: pendingConflicts } = await supabase
      .from('sync_conflicts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('resolution_status', 'pending');

    // Get optional source filter from request
    let sourceFilter: string | null = null;
    try {
      const body = await request.json();
      sourceFilter = body.sourceType || null;
    } catch {
      // No body provided, that's fine
    }

    // Get unreconciled transactions for user
    let txQuery = supabase
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
      .order('date', { ascending: false });

    // Apply source filter if specified
    if (sourceFilter) {
      txQuery = txQuery.eq('source_type', sourceFilter);
    }

    const { data: transactions, error: txError } = await txQuery;

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    // Get unreconciled documents for user
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

    let matchedCount = 0;
    const matchedPairs: Array<{ transaction_id: string; document_id: string }> = [];

    // Auto-match high-confidence matches
    for (const tx of (transactions || [])) {
      // Skip if already matched
      if ((tx as any).matched_document_id) continue;

      // Find best match
      let bestMatch: any = null;
      let bestScore = 0;

      for (const doc of (documents || [])) {
        // Skip if already matched
        if ((doc as any).matched_transaction_id) continue;

        const txAny = tx as any;
        const docAny = doc as any;
        const amountDiff = Math.abs((txAny.amount || 0) - (docAny.total_amount || 0));
        const dateDiff = docAny.invoice_date 
          ? Math.abs(
              (new Date(txAny.date).getTime() - new Date(docAny.invoice_date).getTime()) / 
              (1000 * 60 * 60 * 24)
            )
          : 999;

        // Only consider exact or near-exact amount matches within 7 days
        if (amountDiff < 0.01 && dateDiff <= 7) {
          // Calculate match score (higher is better)
          const amountScore = 100 - amountDiff;
          const dateScore = 100 - dateDiff;
          const descriptionScore = calculateDescriptionMatch(
            txAny.original_description,
            docAny.vendor_name || docAny.original_filename
          );
          
          const totalScore = amountScore * 0.5 + dateScore * 0.3 + descriptionScore * 0.2;

          if (totalScore > bestScore && totalScore >= 80) {
            bestScore = totalScore;
            bestMatch = doc;
          }
        }
      }

      // If we found a high-confidence match, create it
      if (bestMatch) {
        const txAny = tx as any;
        const { error: matchError } = await (supabase.rpc as any)(
          'match_transaction_with_document',
          {
            p_transaction_id: txAny.id,
            p_document_id: (bestMatch as any).id,
          }
        );

        if (!matchError) {
          matchedCount++;
          matchedPairs.push({
            transaction_id: txAny.id,
            document_id: (bestMatch as any).id,
          });
          
          // Mark document as matched to avoid duplicate matches
          (bestMatch as any).matched_transaction_id = txAny.id;
        }
      }
    }

    // Build warnings array
    const warnings: string[] = [];
    if (hasSyncInProgress) {
      warnings.push('A sync is currently in progress. Some transactions may not be included.');
    }
    if (pendingConflicts && pendingConflicts > 0) {
      warnings.push(`${pendingConflicts} sync conflict(s) should be resolved for complete reconciliation.`);
    }

    return NextResponse.json({
      success: true,
      matched_count: matchedCount,
      matches: matchedPairs,
      message: `Successfully auto-matched ${matchedCount} transaction(s)`,
      sync_status: {
        has_sync_in_progress: hasSyncInProgress,
        pending_conflicts: pendingConflicts || 0,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    });
  } catch (error) {
    console.error('Auto-match error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
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

