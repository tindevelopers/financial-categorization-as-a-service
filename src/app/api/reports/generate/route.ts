import { createClient } from '@/core/database/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      reportType, 
      format, 
      startDate, 
      endDate,
      categories,
      includeUnconfirmed 
    } = body

    // Build query based on filters
    let query = supabase
      .from('categorized_transactions')
      .select('*')
      .eq('user_id', user.id)

    if (startDate) query = query.gte('transaction_date', startDate)
    if (endDate) query = query.lte('transaction_date', endDate)
    if (categories && categories.length > 0) {
      query = query.in('category', categories)
    }
    if (!includeUnconfirmed) {
      query = query.eq('confirmed', true)
    }

    query = query.order('transaction_date', { ascending: false })

    const { data: transactions, error } = await query

    if (error) throw error

    // Generate report based on type
    let reportData: any = {}

    switch (reportType) {
      case 'summary':
        reportData = generateSummaryReport(transactions || [])
        break
      case 'category':
        reportData = generateCategoryReport(transactions || [])
        break
      case 'monthly':
        reportData = generateMonthlyReport(transactions || [])
        break
      case 'transactions':
        reportData = {
          transactions: transactions || [],
          total: transactions?.length || 0,
        }
        break
      default:
        reportData = { transactions: transactions || [] }
    }

    // Return data in requested format
    if (format === 'json') {
      return NextResponse.json({
        reportType,
        generatedAt: new Date().toISOString(),
        dateRange: { startDate, endDate },
        ...reportData,
      })
    }

    if (format === 'csv') {
      const csv = generateCSV(transactions || [])
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="report-${Date.now()}.csv"`,
        },
      })
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}

function generateSummaryReport(transactions: any[]) {
  const totalAmount = transactions.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0)
  const categories = [...new Set(transactions.map(t => t.category))]
  
  return {
    summary: {
      totalTransactions: transactions.length,
      totalAmount: totalAmount.toFixed(2),
      uniqueCategories: categories.length,
      confirmedCount: transactions.filter(t => t.confirmed).length,
      unconfirmedCount: transactions.filter(t => !t.confirmed).length,
    },
    categories: categories.map(cat => {
      const catTransactions = transactions.filter(t => t.category === cat)
      return {
        category: cat,
        count: catTransactions.length,
        amount: catTransactions.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0).toFixed(2),
      }
    }),
  }
}

function generateCategoryReport(transactions: any[]) {
  const categoryMap = transactions.reduce((acc: any, t) => {
    const cat = t.category || 'Uncategorized'
    if (!acc[cat]) {
      acc[cat] = {
        transactions: [],
        total: 0,
        count: 0,
      }
    }
    acc[cat].transactions.push(t)
    acc[cat].total += parseFloat(t.amount || '0')
    acc[cat].count++
    return acc
  }, {})

  return {
    categories: Object.entries(categoryMap).map(([name, data]: [string, any]) => ({
      name,
      count: data.count,
      total: data.total.toFixed(2),
      transactions: data.transactions,
    })),
  }
}

function generateMonthlyReport(transactions: any[]) {
  const monthlyMap = transactions.reduce((acc: any, t) => {
    const date = new Date(t.transaction_date || t.created_at)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    
    if (!acc[monthKey]) {
      acc[monthKey] = {
        transactions: [],
        total: 0,
        count: 0,
      }
    }
    
    acc[monthKey].transactions.push(t)
    acc[monthKey].total += parseFloat(t.amount || '0')
    acc[monthKey].count++
    return acc
  }, {})

  return {
    months: Object.entries(monthlyMap)
      .map(([month, data]: [string, any]) => ({
        month,
        count: data.count,
        total: data.total.toFixed(2),
        transactions: data.transactions,
      }))
      .sort((a, b) => b.month.localeCompare(a.month)),
  }
}

function generateCSV(transactions: any[]) {
  const headers = [
    'Date',
    'Description',
    'Category',
    'Subcategory',
    'Amount',
    'Confirmed',
    'Notes',
  ]

  const rows = transactions.map(t => [
    t.transaction_date || '',
    t.description || '',
    t.category || '',
    t.subcategory || '',
    t.amount || '0',
    t.confirmed ? 'Yes' : 'No',
    t.notes || '',
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n')

  return csvContent
}

