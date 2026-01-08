import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';

export const summarizeCounterpartySchema = z.object({
  name: z.string().min(1).describe('Counterparty name to summarize (e.g., Square, Elaine Tucker)'),
  direction: z.enum(['money_in', 'money_out', 'both']).default('both')
    .describe('money_in = receipts, money_out = payments'),
  startDate: z.string().optional().describe('Start date YYYY-MM-DD'),
  endDate: z.string().optional().describe('End date YYYY-MM-DD'),
  groupBy: z.enum(['none', 'month']).default('none')
    .describe('Aggregate by month or overall total'),
  limit: z.number().default(50).describe('Max rows to return when not grouped'),
});

export type SummarizeCounterpartyParams = z.infer<typeof summarizeCounterpartySchema>;

export const summarizeCounterpartyDescription = `Summarize totals by counterparty (payee/payer).
Use when the user asks: "How much came in from Square in Nov 2024?" or
"How much did we pay to Elaine Tucker between Oct and Dec?". Returns totals and optional monthly breakdown.`;

type TxRow = {
  date: string | null;
  amount: number | null;
  is_debit: boolean | null;
  paid_in_amount: number | null;
  paid_out_amount: number | null;
  payee_name: string | null;
  payer_name: string | null;
  original_description?: string | null;
};

export async function executeSummarizeCounterparty(
  params: SummarizeCounterpartyParams,
  userId: string,
  supabase: SupabaseClient
) {
  try {
    let query = supabase
      .from('categorized_transactions')
      .select(`
        date,
        amount,
        is_debit,
        paid_in_amount,
        paid_out_amount,
        payee_name,
        payer_name,
        original_description,
        job:categorization_jobs!inner(user_id)
      `)
      .eq('job.user_id', userId);

    if (params.startDate) query = query.gte('date', params.startDate);
    if (params.endDate) query = query.lte('date', params.endDate);

    const { data, error } = await query;
    if (error) {
      return { success: false, error: `Failed to query transactions: ${error.message}` };
    }

    const nameLower = params.name.toLowerCase();
    const rows: TxRow[] = data || [];

    const filtered = rows.filter((row) => {
      const payee = (row.payee_name || '').toLowerCase();
      const payer = (row.payer_name || '').toLowerCase();
      const desc = (row.original_description || '').toLowerCase();

      const matchesIn = params.direction !== 'money_out' && (payer.includes(nameLower) || desc.includes(nameLower));
      const matchesOut = params.direction !== 'money_in' && (payee.includes(nameLower) || desc.includes(nameLower));

      return matchesIn || matchesOut;
    });

    let totalIn = 0;
    let totalOut = 0;

    const monthly: Record<string, { in: number; out: number; count: number }> = {};

    for (const row of filtered) {
      const paidIn = row.paid_in_amount ?? (row.is_debit === false ? Number(row.amount || 0) : 0);
      const paidOut = row.paid_out_amount ?? (row.is_debit ? Number(row.amount || 0) : 0);

      if (params.direction === 'money_in' || params.direction === 'both') {
        totalIn += paidIn;
      }
      if (params.direction === 'money_out' || params.direction === 'both') {
        totalOut += paidOut;
      }

      if (params.groupBy === 'month' && row.date) {
        const d = new Date(row.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthly[key]) monthly[key] = { in: 0, out: 0, count: 0 };
        monthly[key].in += paidIn;
        monthly[key].out += paidOut;
        monthly[key].count += 1;
      }
    }

    const monthlyBreakdown = params.groupBy === 'month'
      ? Object.entries(monthly)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, v]) => ({ month, money_in: v.in, money_out: v.out, transactions: v.count }))
      : undefined;

    return {
      success: true,
      counterparty: params.name,
      direction: params.direction,
      total_money_in: Number(totalIn.toFixed(2)),
      total_money_out: Number(totalOut.toFixed(2)),
      count: filtered.length,
      monthly: monthlyBreakdown,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

