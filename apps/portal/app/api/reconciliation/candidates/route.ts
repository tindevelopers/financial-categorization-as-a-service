import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    // Cast to any for tables not in generated types
    const db = supabase as any;
    
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
    const statusFilter = searchParams.get('status'); // 'unreconciled', 'matched', or null for all
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get source filter if provided
    const sourceType = searchParams.get('sourceType'); // 'upload', 'google_sheets', 'manual', 'api'
    const bankAccountId = searchParams.get('bank_account_id');
    const processor = searchParams.get('processor');

    // If a processor filter is used, resolve job IDs up front (we filter transactions by job_id).
    // (We intentionally keep this simple: processor slug is used as the keyword.)
    let processorJobIds: string[] | null = null;
    if (!bankAccountId && processor) {
      const { data: procJobs, error: procJobsError } = await db
        .from('categorization_jobs')
        .select('id')
        .eq('user_id', user.id)
        .ilike('original_filename', `%${processor}%`)
        .limit(500);

      if (procJobsError) {
        console.error('Error fetching processor jobs:', procJobsError);
        return NextResponse.json({ error: 'Failed to fetch processor jobs' }, { status: 500 });
      }

      processorJobIds = (procJobs || []).map((j: any) => j.id);

      // No matching jobs => empty result set scoped to this processor
      if (processorJobIds && processorJobIds.length === 0) {
        return NextResponse.json({
          transactions: [],
          summary: {
            total_unreconciled: 0,
            total_matched: 0,
            total_documents: 0,
          },
        });
      }
    }

    // Get transactions (all or filtered by status)
    // Now includes source tracking fields for sync-aware reconciliation
    let txQuery = db
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
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status if specified
    if (statusFilter) {
      txQuery = txQuery.eq('reconciliation_status', statusFilter);
    }

    // Filter by source type if specified
    if (sourceType) {
      txQuery = txQuery.eq('source_type', sourceType);
    }

    // Filter by bank account if specified (takes precedence over processor)
    if (bankAccountId) {
      txQuery = txQuery.eq('bank_account_id', bankAccountId);
    } else if (processorJobIds) {
      txQuery = txQuery.in('job_id', processorJobIds);
    }

    const { data: transactions, error: txError } = await txQuery;

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    // Get unreconciled documents (for potential matches)
    // Try financial_documents first, fallback to documents for backward compatibility
    const { data: documents, error: docError } = await db
      .from('financial_documents')
      .select(`
        id, original_filename, vendor_name, document_date, 
        total_amount, subtotal_amount, tax_amount, fee_amount, net_amount, 
        tax_rate, line_items, payment_method, po_number,
        bank_account_id,
        reconciliation_status, matched_transaction_id, 
        file_type, mime_type, file_size_bytes, ocr_status, extracted_text,
        supabase_path, storage_tier, extracted_data, category, subcategory,
        tags, description, notes
      `)
      .eq('user_id', user.id)
      .eq('reconciliation_status', 'unreconciled')
      .is('matched_transaction_id', null)
      .order('document_date', { ascending: false });

    if (docError) {
      console.error('Error fetching documents:', docError);
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    // Get matched documents for transactions that have matched_document_id
    const matchedTxIds = (transactions || [])
      .filter((tx: any) => tx.matched_document_id)
      .map((tx: any) => tx.matched_document_id);
    
    let matchedDocuments: any[] = [];
    if (matchedTxIds.length > 0) {
      const { data: docs } = await db
        .from('financial_documents')
        .select(`
          id,
          original_filename,
          vendor_name,
          document_date,
          total_amount,
          file_type,
          mime_type,
          supabase_path,
          storage_tier,
          extracted_text,
          extracted_data,
          category,
          subcategory,
          tags,
          description,
          notes
        `)
        .in('id', matchedTxIds);
      
      matchedDocuments = docs || [];
    }

    // Create a map for quick lookup
    const matchedDocsMap = new Map(matchedDocuments.map((doc: any) => [doc.id, doc]));

    // Process transactions: add potential matches for unreconciled, include matched document for matched
    const transactionsWithMatches = (transactions || []).map((tx: any) => {
      // If transaction is matched, get the matched document
      const matchedDocument = tx.matched_document_id && matchedDocsMap.has(tx.matched_document_id)
        ? {
            ...matchedDocsMap.get(tx.matched_document_id),
            invoice_date: matchedDocsMap.get(tx.matched_document_id)?.document_date, // Alias for backward compatibility
          }
        : null;

      // For unreconciled transactions, find potential matches
      let potentialMatches: any[] = [];
      if (tx.reconciliation_status === 'unreconciled') {
        potentialMatches = (documents || [])
          .filter((doc: any) => {
            const amountDiff = Math.abs((tx.amount || 0) - (doc.total_amount || 0));
            const dateDiff = doc.document_date 
              ? Math.abs(
                  (new Date(tx.date).getTime() - new Date(doc.document_date).getTime()) / 
                  (1000 * 60 * 60 * 24)
                )
              : 999;
            
            // Only show matches within reasonable thresholds
            return amountDiff < 100 && dateDiff <= 60;
          })
          .map((doc: any) => {
            const amountDiff = Math.abs((tx.amount || 0) - (doc.total_amount || 0));
            const dateDiff = doc.document_date
              ? Math.abs(
                  (new Date(tx.date).getTime() - new Date(doc.document_date).getTime()) / 
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
              invoice_date: doc.document_date,  // Alias for backward compatibility
              match_confidence: matchConfidence,
              amount_difference: amountDiff,
              days_difference: dateDiff,
              account_match: !!(bankAccountId && doc.bank_account_id && doc.bank_account_id === bankAccountId),
            };
          })
          .sort((a: any, b: any) => {
            // Sort by confidence, then by amount difference
            const confidenceScore: { [key: string]: number } = { high: 3, medium: 2, low: 1 };
            const aScore = confidenceScore[a.match_confidence] || 0;
            const bScore = confidenceScore[b.match_confidence] || 0;
            
            if (aScore !== bScore) return bScore - aScore;
            // Prefer account-consistent matches when scoped to a bank account
            if (bankAccountId) {
              const aAcct = a.account_match ? 1 : 0;
              const bAcct = b.account_match ? 1 : 0;
              if (aAcct !== bAcct) return bAcct - aAcct;
            }
            return a.amount_difference - b.amount_difference;
          })
          .slice(0, 5); // Top 5 matches per transaction
      }

      return {
        ...tx,
        matched_document: matchedDocument,
        potential_matches: potentialMatches,
        // Include sync status info for UI
        sync_info: {
          source_type: tx.source_type || 'upload',
          source_identifier: tx.source_identifier,
          last_synced_at: tx.last_synced_at,
          sync_version: tx.sync_version || 1,
        },
      };
    });

    // Get summary stats - need to get all user's jobs first
    const { data: userJobs } = await db
      .from('categorization_jobs')
      .select('id')
      .eq('user_id', user.id);
    
    const jobIds = (userJobs || []).map((j: any) => j.id);
    const summaryJobIds = processorJobIds || jobIds;
    
    let unreconciledQuery = db
      .from('categorized_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('reconciliation_status', 'unreconciled')
      .in('job_id', summaryJobIds.length > 0 ? summaryJobIds : ['']);

    let matchedQuery = db
      .from('categorized_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('reconciliation_status', 'matched')
      .in('job_id', summaryJobIds.length > 0 ? summaryJobIds : ['']);

    if (bankAccountId) {
      unreconciledQuery = unreconciledQuery.eq('bank_account_id', bankAccountId);
      matchedQuery = matchedQuery.eq('bank_account_id', bankAccountId);
    }

    const { count: totalUnreconciled } = await unreconciledQuery;
    const { count: totalMatched } = await matchedQuery;

    return NextResponse.json({
      transactions: transactionsWithMatches,
      summary: {
        total_unreconciled: totalUnreconciled || 0,
        total_matched: totalMatched || 0,
        total_documents: (documents || []).length,
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
