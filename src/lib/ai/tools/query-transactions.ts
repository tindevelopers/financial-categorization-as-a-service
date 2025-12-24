/**
 * Query Transactions Tool
 * 
 * Allows the AI to search and filter transactions
 */

import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';

export const queryTransactionsSchema = z.object({
  startDate: z.string().optional().describe('Start date in YYYY-MM-DD format'),
  endDate: z.string().optional().describe('End date in YYYY-MM-DD format'),
  category: z.string().optional().describe('Filter by category name'),
  subcategory: z.string().optional().describe('Filter by subcategory name'),
  minAmount: z.number().optional().describe('Minimum transaction amount'),
  maxAmount: z.number().optional().describe('Maximum transaction amount'),
  searchTerm: z.string().optional().describe('Search in transaction description'),
  confirmed: z.boolean().optional().describe('Filter by confirmation status'),
  jobId: z.string().optional().describe('Filter by specific job ID'),
  limit: z.number().default(10).describe('Maximum number of results to return'),
  orderBy: z.enum(['date', 'amount', 'category']).default('date').describe('Field to sort by'),
  orderDirection: z.enum(['asc', 'desc']).default('desc').describe('Sort direction'),
});

export type QueryTransactionsParams = z.infer<typeof queryTransactionsSchema>;

export const queryTransactionsDescription = `Search and filter the user's transactions by various criteria. 
Use this tool when the user asks about their transactions, expenses, income, 
or wants to see specific categories or date ranges.`;

export async function executeQueryTransactions(
  params: QueryTransactionsParams, 
  userId: string, 
  supabase: SupabaseClient
) {
  try {
    // Start with base query joining with jobs to filter by user
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
        created_at,
        job:categorization_jobs!inner(id, user_id, original_filename, status)
      `)
      .eq('job.user_id', userId);

    // Apply filters
    if (params.startDate) {
      query = query.gte('date', params.startDate);
    }
    if (params.endDate) {
      query = query.lte('date', params.endDate);
    }
    if (params.category) {
      query = query.ilike('category', `%${params.category}%`);
    }
    if (params.subcategory) {
      query = query.ilike('subcategory', `%${params.subcategory}%`);
    }
    if (params.minAmount !== undefined) {
      query = query.gte('amount', params.minAmount);
    }
    if (params.maxAmount !== undefined) {
      query = query.lte('amount', params.maxAmount);
    }
    if (params.searchTerm) {
      query = query.ilike('original_description', `%${params.searchTerm}%`);
    }
    if (params.confirmed !== undefined) {
      query = query.eq('user_confirmed', params.confirmed);
    }
    if (params.jobId) {
      query = query.eq('job_id', params.jobId);
    }

    // Apply ordering
    const ascending = params.orderDirection === 'asc';
    query = query.order(params.orderBy, { ascending });

    // Apply limit
    query = query.limit(params.limit);

    const { data, error } = await query;

    if (error) {
      return {
        success: false,
        error: `Failed to query transactions: ${error.message}`,
        transactions: [],
        count: 0,
      };
    }

    // Calculate summary statistics
    const transactions = data || [];
    const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const categories = [...new Set(transactions.map(t => t.category).filter(Boolean))];

    return {
      success: true,
      transactions: transactions.map(t => ({
        id: t.id,
        description: t.original_description,
        amount: t.amount,
        date: t.date,
        category: t.category || 'Uncategorized',
        subcategory: t.subcategory,
        confidence: t.confidence_score,
        confirmed: t.user_confirmed,
        notes: t.user_notes,
      })),
      count: transactions.length,
      summary: {
        totalAmount: totalAmount.toFixed(2),
        categories,
        dateRange: transactions.length > 0 
          ? { 
              from: transactions[transactions.length - 1].date, 
              to: transactions[0].date 
            }
          : null,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      transactions: [],
      count: 0,
    };
  }
}
