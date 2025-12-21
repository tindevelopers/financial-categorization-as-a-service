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
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Get transactions with categories
    let query = supabase
      .from('categorized_transactions')
      .select('amount, category, subcategory')
      .eq('user_id', user.id)

    if (startDate) query = query.gte('created_at', startDate)
    if (endDate) query = query.lte('created_at', endDate)

    const { data: transactions, error } = await query

    if (error) throw error

    // Group by category
    const categoryMap = (transactions || []).reduce((acc: any, t: any) => {
      const category = t.category || 'Uncategorized'
      const subcategory = t.subcategory || 'Other'
      
      if (!acc[category]) {
        acc[category] = {
          category,
          total: 0,
          count: 0,
          subcategories: {}
        }
      }

      const amount = Math.abs(parseFloat(t.amount || '0'))
      acc[category].total += amount
      acc[category].count++

      if (!acc[category].subcategories[subcategory]) {
        acc[category].subcategories[subcategory] = {
          name: subcategory,
          amount: 0,
          count: 0
        }
      }
      acc[category].subcategories[subcategory].amount += amount
      acc[category].subcategories[subcategory].count++

      return acc
    }, {})

    // Convert to array and sort by total
    const categories = Object.values(categoryMap)
      .map((cat: any) => ({
        category: cat.category,
        total: parseFloat(cat.total.toFixed(2)),
        count: cat.count,
        subcategories: Object.values(cat.subcategories).map((sub: any) => ({
          name: sub.name,
          amount: parseFloat(sub.amount.toFixed(2)),
          count: sub.count
        }))
      }))
      .sort((a: any, b: any) => b.total - a.total)

    // Calculate totals
    const totalSpending = categories.reduce((sum: number, cat: any) => sum + cat.total, 0)

    return NextResponse.json({
      categories,
      totalSpending: parseFloat(totalSpending.toFixed(2)),
      totalTransactions: transactions?.length || 0,
    })
  } catch (error) {
    console.error('Error fetching spending by category:', error)
    return NextResponse.json(
      { error: 'Failed to fetch spending by category' },
      { status: 500 }
    )
  }
}

