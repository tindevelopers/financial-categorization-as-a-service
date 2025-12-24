import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/core/database/server';
import { google } from 'googleapis';

/**
 * Push reconciled transactions to Google Sheets
 * Includes tax breakdown columns
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
    const { spreadsheetId, sheetName, jobId, onlyReconciled } = body;

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Missing spreadsheetId' },
        { status: 400 }
      );
    }

    // Get transactions to export
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

    if (onlyReconciled) {
      query = query.eq('reconciliation_status', 'matched');
    }

    const { data: transactions, error: txError } = await query;

    if (txError) {
      throw new Error(`Failed to fetch transactions: ${txError.message}`);
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({
        success: true,
        exported: 0,
        message: 'No transactions to export',
      });
    }

    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Prepare rows
    const header = [
      'Date',
      'Description',
      'Gross Amount',
      'Net Amount',
      'VAT',
      'VAT Rate %',
      'Fees',
      'Category',
      'Subcategory',
      'Vendor',
      'Receipt File',
      'Status',
      'Notes',
    ];

    const rows = transactions.map((tx: any) => {
      const doc = tx.document;
      return [
        tx.date,
        tx.original_description,
        tx.amount,
        doc?.net_amount || tx.amount,
        doc?.tax_amount || 0,
        doc?.tax_rate || 0,
        doc?.fee_amount || 0,
        tx.category || '',
        tx.subcategory || '',
        doc?.vendor_name || tx.merchant || '',
        doc?.original_filename || '',
        tx.reconciliation_status,
        tx.reconciliation_notes || '',
      ];
    });

    // Write to sheet
    const range = sheetName ? `${sheetName}!A1` : 'A1';
    
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [header, ...rows],
      },
    });

    // Format header row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      exported: transactions.length,
      spreadsheetId,
      sheetName: sheetName || 'Sheet1',
    });

  } catch (error: any) {
    console.error('Sheets push error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

