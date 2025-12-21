import { createClient } from '@/core/database/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d' // 7d, 30d, 90d, 12m

    // Calculate date range based on period
    const now = new Date()
    let startDate = new Date()
    let groupBy = 'day'

    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7)
        groupBy = 'day'
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        groupBy = 'day'
        break
      case '90d':
        startDate.setDate(now.getDate() - 90)
        groupBy = 'week'
        break
      case '12m':
        startDate.setFullYear(now.getFullYear() - 1)
        groupBy = 'month'
        break
    }

    // Get transactions for the period
    const { data: transactions, error } = await supabase
      .from('categorized_transactions')
      .select('amount, category, created_at, transaction_date')
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })

    if (error) throw error

    // Group transactions by time period
    const trends = transactions?.reduce((acc: any, t) => {
      const date = new Date(t.transaction_date || t.created_at)
      let key = ''

      switch (groupBy) {
        case 'day':
          key = date.toISOString().split('T')[0]
          break
        case 'week':
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          key = weekStart.toISOString().split('T')[0]
          break
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          break
      }

      if (!acc[key]) {
        acc[key] = {
          date: key,
          count: 0,
          amount: 0,
          categories: {}
        }
      }

      const amount = parseFloat(t.amount || '0')
      acc[key].count++
      acc[key].amount += amount

      const category = t.category || 'Uncategorized'
      if (!acc[key].categories[category]) {
        acc[key].categories[category] = 0
      }
      acc[key].categories[category] += amount

      return acc
    }, {}) || {}

    // Convert to array and sort by date
    const trendsArray = Object.values(trends).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Format amounts
    const formattedTrends = trendsArray.map((t: any) => ({
      date: t.date,
      count: t.count,
      amount: parseFloat(t.amount.toFixed(2)),
      categories: Object.entries(t.categories).map(([name, amount]: [string, any]) => ({
        name,
        amount: parseFloat(amount.toFixed(2))
      }))
    }))

    return NextResponse.json({
      period,
      groupBy,
      trends: formattedTrends,
    })
  } catch (error) {
    console.error('Error fetching trends:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trends' },
      { status: 500 }
    )
  }
}

