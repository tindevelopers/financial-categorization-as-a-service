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
    
    // Filters
    const searchQuery = searchParams.get('q') || ''
    const category = searchParams.get('category')
    const subcategory = searchParams.get('subcategory')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const minAmount = searchParams.get('min_amount')
    const maxAmount = searchParams.get('max_amount')
    const confirmed = searchParams.get('confirmed')
    const jobId = searchParams.get('job_id')
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('categorized_transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)

    // Apply filters
    if (searchQuery) {
      query = query.or(`description.ilike.%${searchQuery}%,notes.ilike.%${searchQuery}%`)
    }
    
    if (category) {
      query = query.eq('category', category)
    }
    
    if (subcategory) {
      query = query.eq('subcategory', subcategory)
    }
    
    if (startDate) {
      query = query.gte('transaction_date', startDate)
    }
    
    if (endDate) {
      query = query.lte('transaction_date', endDate)
    }
    
    if (minAmount) {
      query = query.gte('amount', parseFloat(minAmount))
    }
    
    if (maxAmount) {
      query = query.lte('amount', parseFloat(maxAmount))
    }
    
    if (confirmed !== null) {
      query = query.eq('confirmed', confirmed === 'true')
    }
    
    if (jobId) {
      query = query.eq('job_id', jobId)
    }

    // Apply pagination and sorting
    query = query
      .order('transaction_date', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: transactions, count, error } = await query

    if (error) throw error

    // Get unique categories for filter options
    const { data: categories } = await supabase
      .from('categorized_transactions')
      .select('category')
      .eq('user_id', user.id)
      .not('category', 'is', null)
      .limit(1000)

    const uniqueCategories = [...new Set(categories?.map(c => c.category) || [])]

    return NextResponse.json({
      transactions: transactions || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      filters: {
        categories: uniqueCategories,
      },
    })
  } catch (error) {
    console.error('Error searching transactions:', error)
    return NextResponse.json(
      { error: 'Failed to search transactions' },
      { status: 500 }
    )
  }
}

