/**
 * Get Job Stats Tool
 * 
 * Allows the AI to retrieve statistics for categorization jobs
 */

import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';

export const getJobStatsSchema = z.object({
  jobId: z.string().optional().describe('Get stats for a specific job ID'),
  status: z.enum(['all', 'uploaded', 'processing', 'reviewing', 'completed', 'failed']).default('all').describe(
    'Filter jobs by status'
  ),
  limit: z.number().default(5).describe('Number of recent jobs to include'),
  includeCategorySummary: z.boolean().default(true).describe(
    'Include breakdown by category'
  ),
});

export type GetJobStatsParams = z.infer<typeof getJobStatsSchema>;

export const getJobStatsDescription = `Get statistics and summary information for categorization jobs.
Use this tool when the user asks about:
- Their upload/processing history
- How many transactions have been categorized
- Job completion status
- Summary of categorization results`;

export async function executeGetJobStats(
  params: GetJobStatsParams, 
  userId: string, 
  supabase: SupabaseClient
) {
  try {
    // Query jobs
    let jobsQuery = supabase
      .from('categorization_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (params.jobId) {
      jobsQuery = jobsQuery.eq('id', params.jobId);
    }
    if (params.status !== 'all') {
      jobsQuery = jobsQuery.eq('status', params.status);
    }

    jobsQuery = jobsQuery.limit(params.limit);

    const { data: jobs, error: jobsError } = await jobsQuery;

    if (jobsError) {
      return {
        success: false,
        error: `Failed to fetch jobs: ${jobsError.message}`,
      };
    }

    if (!jobs || jobs.length === 0) {
      return {
        success: true,
        found: false,
        message: params.jobId 
          ? 'Job not found or you do not have access to it.'
          : 'No categorization jobs found.',
        jobs: [],
      };
    }

    // Get transaction stats for each job
    const jobStats = await Promise.all(jobs.map(async (job) => {
      // Get transaction counts and category breakdown
      const { data: transactions, error: txError } = await supabase
        .from('categorized_transactions')
        .select('category, user_confirmed, confidence_score')
        .eq('job_id', job.id);

      if (txError || !transactions) {
        return {
          id: job.id,
          filename: job.original_filename,
          status: job.status,
          type: job.job_type,
          createdAt: job.created_at,
          totalItems: job.total_items || 0,
          processedItems: job.processed_items || 0,
          error: txError?.message,
        };
      }

      // Calculate stats
      const totalTransactions = transactions.length;
      const confirmedCount = transactions.filter(t => t.user_confirmed).length;
      const avgConfidence = transactions.length > 0
        ? transactions.reduce((sum, t) => sum + (t.confidence_score || 0), 0) / transactions.length
        : 0;

      // Category breakdown
      const categoryBreakdown: Record<string, { count: number; total: number }> = {};
      transactions.forEach(t => {
        const cat = t.category || 'Uncategorized';
        if (!categoryBreakdown[cat]) {
          categoryBreakdown[cat] = { count: 0, total: 0 };
        }
        categoryBreakdown[cat].count++;
      });

      // Convert to array and sort
      const categories = Object.entries(categoryBreakdown)
        .map(([name, data]) => ({
          name,
          count: data.count,
          percentage: ((data.count / totalTransactions) * 100).toFixed(1),
        }))
        .sort((a, b) => b.count - a.count);

      return {
        id: job.id,
        filename: job.original_filename,
        status: job.status,
        type: job.job_type,
        createdAt: job.created_at,
        completedAt: job.completed_at,
        stats: {
          totalTransactions,
          confirmed: confirmedCount,
          pending: totalTransactions - confirmedCount,
          confirmationRate: `${((confirmedCount / totalTransactions) * 100).toFixed(1)}%`,
          averageConfidence: `${(avgConfidence * 100).toFixed(1)}%`,
        },
        categories: params.includeCategorySummary ? categories.slice(0, 10) : undefined,
      };
    }));

    // Overall summary
    const totalJobs = jobStats.length;
    const totalTransactions = jobStats.reduce(
      (sum, j) => sum + (j.stats?.totalTransactions || 0), 
      0
    );
    const totalConfirmed = jobStats.reduce(
      (sum, j) => sum + (j.stats?.confirmed || 0), 
      0
    );

    return {
      success: true,
      found: true,
      summary: {
        totalJobs,
        totalTransactions,
        totalConfirmed,
        overallConfirmationRate: totalTransactions > 0 
          ? `${((totalConfirmed / totalTransactions) * 100).toFixed(1)}%`
          : '0%',
      },
      jobs: jobStats,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
