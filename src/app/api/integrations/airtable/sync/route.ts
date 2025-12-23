import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/core/database/server';
import Airtable from 'airtable';
import type { Transaction } from '@/lib/sync/types';

/**
 * Sync transactions with Airtable base
 * Bidirectional sync with conflict resolution
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { baseId, tableName, direction = 'push', jobId } = body;

    if (!baseId || !tableName) {
      return NextResponse.json(
        { error: 'Missing baseId or tableName' },
        { status: 400 }
      );
    }

    // Initialize Airtable
    const airtableApiKey = process.env.AIRTABLE_API_KEY;
    if (!airtableApiKey) {
      throw new Error('Airtable API key not configured');
    }

    const base = new Airtable({ apiKey: airtableApiKey }).base(baseId);

    if (direction === 'push') {
      // Push transactions to Airtable
      let query = supabase
        .from('categorized_transactions')
        .select(`
          *,
          job:categorization_jobs!inner(user_id),
          document:financial_documents(
            vendor_name,
            subtotal_amount,
            tax_amount,
            tax_rate,
            fee_amount,
            net_amount,
            original_filename
          )
        `)
        .eq('job.user_id', user.id);

      if (jobId) {
        query = query.eq('job_id', jobId);
      }

      const { data: transactions, error: txError } = await query;

      if (txError) {
        throw new Error(`Failed to fetch transactions: ${txError.message}`);
      }

      if (!transactions || transactions.length === 0) {
        return NextResponse.json({
          success: true,
          pushed: 0,
          message: 'No transactions to push',
        });
      }

      // Batch create/update records in Airtable
      const records = transactions.map((tx: any) => {
        const doc = tx.document;
        return {
          fields: {
            'Transaction ID': tx.id,
            'Date': tx.date,
            'Description': tx.original_description,
            'Gross Amount': tx.amount,
            'Net Amount': doc?.net_amount || tx.amount,
            'VAT': doc?.tax_amount || 0,
            'VAT Rate': doc?.tax_rate || 0,
            'Fees': doc?.fee_amount || 0,
            'Category': tx.category || '',
            'Subcategory': tx.subcategory || '',
            'Vendor': doc?.vendor_name || tx.merchant || '',
            'Receipt File': doc?.original_filename || '',
            'Status': tx.reconciliation_status,
            'Notes': tx.reconciliation_notes || '',
          },
        };
      });

      // Airtable has a limit of 10 records per request
      const batchSize = 10;
      let pushed = 0;

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await base(tableName).create(batch);
        pushed += batch.length;
      }

      return NextResponse.json({
        success: true,
        pushed,
        direction: 'push',
      });

    } else {
      // Pull transactions from Airtable
      const records = await base(tableName).select().all();

      const transactions: Transaction[] = records.map(record => ({
        original_description: record.get('Description') as string || '',
        amount: parseFloat(record.get('Gross Amount') as string || '0'),
        date: record.get('Date') as string || new Date().toISOString(),
        category: record.get('Category') as string || null,
        subcategory: record.get('Subcategory') as string || null,
        source_type: 'airtable' as const,
        source_identifier: baseId,
      }));

      // Use TransactionMergeService to merge
      const { TransactionMergeService } = await import('@/lib/sync/TransactionMergeService');
      const mergeService = new TransactionMergeService(supabase, user.id);
      
      const result = await mergeService.processUploadWithMerge(transactions, {
        sourceType: 'airtable',
        sourceIdentifier: baseId,
        originalFilename: `Airtable Import ${new Date().toLocaleDateString()}`,
        createJob: true,
      });

      return NextResponse.json({
        success: true,
        imported: result.inserted,
        duplicates: result.skipped,
        errors: 0,
        direction: 'pull',
        jobId: result.jobId,
      });
    }

  } catch (error: any) {
    console.error('Airtable sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

