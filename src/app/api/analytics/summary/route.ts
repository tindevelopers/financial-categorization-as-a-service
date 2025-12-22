import { createClient } from '@/core/database/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analytics/summary/route.ts:GET',message:'Analytics summary endpoint called',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analytics/summary/route.ts:auth',message:'Auth check result',data:{hasUser:!!user,authError:authError?.message||null},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Get total jobs - using correct column names: total_items, processed_items
    let jobsQuery = supabase
      .from('categorization_jobs')
      .select('id, status, total_items, processed_items', { count: 'exact' })
      .eq('user_id', user.id)

    if (startDate) jobsQuery = jobsQuery.gte('created_at', startDate)
    if (endDate) jobsQuery = jobsQuery.lte('created_at', endDate)

    const { data: jobs, count: totalJobs, error: jobsError } = await jobsQuery

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analytics/summary/route.ts:jobs',message:'Jobs query result',data:{totalJobs,jobsError:jobsError?.message||null,jobsCount:jobs?.length||0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    if (jobsError) throw jobsError

    // Get user's job IDs first, then query transactions by job_id
    // (categorized_transactions doesn't have user_id column - it links via job_id)
    const userJobIds = (jobs || []).map((j: { id: string }) => j.id)

    let transactions: { id: string; amount: number | string; category: string | null; user_confirmed: boolean; created_at: string }[] = []
    let totalTransactions = 0
    let transError = null

    if (userJobIds.length > 0) {
      let transactionsQuery = supabase
        .from('categorized_transactions')
        .select('id, amount, category, user_confirmed, created_at', { count: 'exact' })
        .in('job_id', userJobIds)

      if (startDate) transactionsQuery = transactionsQuery.gte('created_at', startDate)
      if (endDate) transactionsQuery = transactionsQuery.lte('created_at', endDate)

      const result = await transactionsQuery
      transactions = result.data || []
      totalTransactions = result.count || 0
      transError = result.error
    }

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analytics/summary/route.ts:transactions',message:'Transactions query result',data:{totalTransactions,transError:transError?.message||null,transCount:transactions?.length||0,userJobIds:userJobIds.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    if (transError) throw transError

    // Calculate metrics - using user_confirmed (correct column name, not 'confirmed')
    const totalAmount = (transactions || []).reduce((sum: number, t: { amount: number | string }) => sum + parseFloat(String(t.amount) || '0'), 0)
    const confirmedTransactions = (transactions || []).filter((t: { user_confirmed: boolean }) => t.user_confirmed).length
    const unconfirmedTransactions = (totalTransactions || 0) - confirmedTransactions

    // Get category breakdown
    const categoryBreakdown = (transactions || []).reduce((acc: Record<string, { count: number; amount: number }>, t: { category: string | null; amount: number | string }) => {
      const category = t.category || 'Uncategorized'
      if (!acc[category]) {
        acc[category] = { count: 0, amount: 0 }
      }
      acc[category].count++
      acc[category].amount += parseFloat(String(t.amount) || '0')
      return acc
    }, {})

    // Get completed jobs (also count 'reviewing' as completed since transactions are processed)
    const completedJobs = (jobs || []).filter((j: { status: string }) => j.status === 'completed' || j.status === 'reviewing').length
    const processingJobs = (jobs || []).filter((j: { status: string }) => j.status === 'processing').length
    const failedJobs = (jobs || []).filter((j: { status: string }) => j.status === 'failed').length

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
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analytics/summary/route.ts:error',message:'Analytics summary error',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.error('Error fetching analytics summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics summary' },
      { status: 500 }
    )
  }
}

