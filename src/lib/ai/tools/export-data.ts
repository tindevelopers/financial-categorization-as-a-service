/**
 * Export Data Tool
 * 
 * Allows the AI to generate data exports in various formats
 */

import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';

export const exportDataSchema = z.object({
  format: z.enum(['csv', 'excel']).default('csv').describe('Export format'),
  jobId: z.string().optional().describe('Export transactions from a specific job'),
  startDate: z.string().optional().describe('Start date filter (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date filter (YYYY-MM-DD)'),
  category: z.string().optional().describe('Filter by category'),
  confirmedOnly: z.boolean().default(false).describe('Only include confirmed transactions'),
  includeNotes: z.boolean().default(true).describe('Include user notes in export'),
});

export type ExportDataParams = z.infer<typeof exportDataSchema>;

export const exportDataDescription = `Generate a downloadable export of transaction data.
Use this tool when the user wants to:
- Download their transactions as CSV or Excel
- Export data for a specific date range or job
- Get data for their accountant

The tool returns export details and a download URL.`;

export async function executeExportData(
  params: ExportDataParams, 
  userId: string, 
  supabase: SupabaseClient
) {
  try {
    // Build query
    let query = supabase
      .from('categorized_transactions')
      .select(`
        id,
        original_description,
        amount,
        date,
        category,
        subcategory,
        confidence_score,
        user_confirmed,
        user_notes,
        job:categorization_jobs!inner(id, user_id, original_filename)
      `)
      .eq('job.user_id', userId)
      .order('date', { ascending: false });

    // Apply filters
    if (params.jobId) {
      query = query.eq('job_id', params.jobId);
    }
    if (params.startDate) {
      query = query.gte('date', params.startDate);
    }
    if (params.endDate) {
      query = query.lte('date', params.endDate);
    }
    if (params.category) {
      query = query.ilike('category', `%${params.category}%`);
    }
    if (params.confirmedOnly) {
      query = query.eq('user_confirmed', true);
    }

    const { data: transactions, error } = await query;

    if (error) {
      return {
        success: false,
        error: `Failed to fetch transactions: ${error.message}`,
      };
    }

    if (!transactions || transactions.length === 0) {
      return {
        success: true,
        found: false,
        message: 'No transactions found matching your criteria.',
      };
    }

    // Generate CSV content
    const headers = [
      'Date',
      'Description',
      'Amount',
      'Category',
      'Subcategory',
      'Confidence',
      'Confirmed',
      ...(params.includeNotes ? ['Notes'] : []),
    ];

    const rows = transactions.map(tx => {
      const row = [
        tx.date,
        `"${(tx.original_description || '').replace(/"/g, '""')}"`,
        tx.amount,
        `"${(tx.category || 'Uncategorized').replace(/"/g, '""')}"`,
        `"${(tx.subcategory || '').replace(/"/g, '""')}"`,
        `${((tx.confidence_score || 0) * 100).toFixed(0)}%`,
        tx.user_confirmed ? 'Yes' : 'No',
      ];
      if (params.includeNotes) {
        row.push(`"${(tx.user_notes || '').replace(/"/g, '""')}"`);
      }
      return row.join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    // Calculate summary
    const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const categories = [...new Set(transactions.map(t => t.category).filter(Boolean))];

    // For now, return the data directly
    // In production, this would upload to storage and return a URL
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = params.jobId 
      ? `fincat-export-${params.jobId.slice(0, 8)}-${timestamp}.${params.format}`
      : `fincat-export-${timestamp}.${params.format}`;

    return {
      success: true,
      found: true,
      message: `Export ready: ${transactions.length} transactions`,
      export: {
        filename,
        format: params.format,
        transactionCount: transactions.length,
        totalAmount: totalAmount.toFixed(2),
        categories: categories.length,
        dateRange: {
          from: transactions[transactions.length - 1].date,
          to: transactions[0].date,
        },
      },
      // In production, replace with actual download URL
      downloadUrl: `/api/exports/download?data=${encodeURIComponent(Buffer.from(csvContent).toString('base64'))}&filename=${filename}`,
      // Provide preview for small exports
      preview: transactions.length <= 5 ? transactions.map(t => ({
        date: t.date,
        description: t.original_description?.substring(0, 50),
        amount: t.amount,
        category: t.category,
      })) : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during export',
    };
  }
}
