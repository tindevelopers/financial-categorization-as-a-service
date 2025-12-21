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

    const body = await request.json();
    const { transaction_id, document_id } = body;

    if (!transaction_id || !document_id) {
      return NextResponse.json(
        { error: 'Missing transaction_id or document_id' },
        { status: 400 }
      );
    }

    // Verify user owns both the transaction and document
    const { data: transaction, error: txError } = await supabase
      .from('categorized_transactions')
      .select(`
        *,
        job:categorization_jobs!inner(user_id)
      `)
      .eq('id', transaction_id)
      .single();

    if (txError || !transaction || (transaction as any).job.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Transaction not found or unauthorized' },
        { status: 404 }
      );
    }

    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found or unauthorized' },
        { status: 404 }
      );
    }

    // Use the database function to match
    const { data: result, error: matchError } = await (supabase.rpc as any)(
      'match_transaction_with_document',
      {
        p_transaction_id: transaction_id,
        p_document_id: document_id,
      }
    );

    if (matchError) {
      console.error('Match error:', matchError);
      return NextResponse.json(
        { error: 'Failed to match transaction and document' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Transaction matched with document successfully',
    });
  } catch (error) {
    console.error('Match error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Unmatch a transaction
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const transaction_id = searchParams.get('transaction_id');

    if (!transaction_id) {
      return NextResponse.json(
        { error: 'Missing transaction_id' },
        { status: 400 }
      );
    }

    // Verify user owns the transaction
    const { data: transaction, error: txError } = await supabase
      .from('categorized_transactions')
      .select(`
        *,
        job:categorization_jobs!inner(user_id)
      `)
      .eq('id', transaction_id)
      .single();

    if (txError || !transaction || (transaction as any).job.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Transaction not found or unauthorized' },
        { status: 404 }
      );
    }

    // Use the database function to unmatch
    const { data: result, error: unmatchError } = await (supabase.rpc as any)(
      'unmatch_transaction',
      {
        p_transaction_id: transaction_id,
      }
    );

    if (unmatchError) {
      console.error('Unmatch error:', unmatchError);
      return NextResponse.json(
        { error: 'Failed to unmatch transaction' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Transaction unmatched successfully',
    });
  } catch (error) {
    console.error('Unmatch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

