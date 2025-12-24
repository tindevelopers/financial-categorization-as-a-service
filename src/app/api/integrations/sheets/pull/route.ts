import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/core/database/server';
import { google } from 'googleapis';
import { TransactionMergeService } from '@/lib/sync/TransactionMergeService';
import type { Transaction } from '@/lib/sync/types';

/**
 * Pull transactions from Google Sheets and merge into database
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
    const { spreadsheetId, sheetName, jobName } = body;

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Missing spreadsheetId' },
        { status: 400 }
      );
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

    // Read data from sheet
    const range = sheetName ? `${sheetName}!A:H` : 'A:H';
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      return NextResponse.json({
        success: true,
        imported: 0,
        duplicates: 0,
        errors: 0,
        message: 'No data found in sheet',
      });
    }

    // Parse rows (assuming first row is header)
    const _header = rows[0];
    const transactions: Transaction[] = rows.slice(1).map(row => ({
      original_description: row[0] || '',
      amount: parseFloat(row[1] || '0'),
      date: row[2] || new Date().toISOString(),
      category: row[3] || null,
      subcategory: row[4] || null,
      source_type: 'google_sheets' as const,
      source_identifier: spreadsheetId,
    }));

    // Use TransactionMergeService to merge without duplicates
    const mergeService = new TransactionMergeService(supabase, user.id);
    
    const result = await mergeService.processUploadWithMerge(transactions, {
      sourceType: 'google_sheets',
      sourceIdentifier: spreadsheetId,
      originalFilename: jobName || `Sheets Import ${new Date().toLocaleDateString()}`,
      createJob: true,
    });

    return NextResponse.json({
      success: true,
      imported: result.inserted,
      duplicates: result.skipped,
      errors: 0,
      jobId: result.jobId,
    });

  } catch (error: any) {
    console.error('Sheets pull error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

