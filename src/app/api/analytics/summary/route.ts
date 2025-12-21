import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Get total jobs
    let jobsQuery = supabase
      .from('categorization_jobs')
      .select('id, status, total_transactions, processed_transactions', { count: 'exact' })
      .eq('user_id', user.id)

    if (startDate) jobsQuery = jobsQuery.gte('created_at', startDate)
    if (endDate) jobsQuery = jobsQuery.lte('created_at', endDate)

    const { data: jobs, count: totalJobs, error: jobsError } = await jobsQuery

    if (jobsError) throw jobsError

    // Get total transactions
    let transactionsQuery = supabase
      .from('categorized_transactions')
      .select('id, amount, category, confirmed, created_at', { count: 'exact' })
      .eq('user_id', user.id)

    if (startDate) transactionsQuery = transactionsQuery.gte('created_at', startDate)
    if (endDate) transactionsQuery = transactionsQuery.lte('created_at', endDate)

    const { data: transactions, count: totalTransactions, error: transError } = await transactionsQuery

    if (transError) throw transError

    // Calculate metrics
    const totalAmount = transactions?.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0) || 0
    const confirmedTransactions = transactions?.filter(t => t.confirmed).length || 0
    const unconfirmedTransactions = (totalTransactions || 0) - confirmedTransactions

    // Get category breakdown
    const categoryBreakdown = transactions?.reduce((acc: any, t) => {
      const category = t.category || 'Uncategorized'
      if (!acc[category]) {
        acc[category] = { count: 0, amount: 0 }
      }
      acc[category].count++
      acc[category].amount += parseFloat(t.amount || '0')
      return acc
    }, {}) || {}

    // Get completed jobs
    const completedJobs = jobs?.filter(j => j.status === 'completed').length || 0
    const processingJobs = jobs?.filter(j => j.status === 'processing').length || 0
    const failedJobs = jobs?.filter(j => j.status === 'failed').length || 0

    return NextResponse.json({
      summary: {
        totalJobs: totalJobs || 0,
        completedJobs,
        processingJobs,
        failedJobs,
        totalTransactions: totalTransactions || 0,
        confirmedTransactions,
        unconfirmedTransactions,
        totalAmount: totalAmount.toFixed(2),
      },
      categoryBreakdown: Object.entries(categoryBreakdown).map(([name, data]: [string, any]) => ({
        name,
        count: data.count,
        amount: data.amount.toFixed(2),
      })),
    })
  } catch (error) {
    console.error('Error fetching analytics summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics summary' },
      { status: 500 }
    )
  }
}

