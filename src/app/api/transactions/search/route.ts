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
    const jobIdParam = searchParams.get('job_id')
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Get user's job IDs first (categorized_transactions links via job_id, not user_id)
    const { data: userJobs } = await supabase
      .from('categorization_jobs')
      .select('id')
      .eq('user_id', user.id)
    
    const userJobIds = (userJobs || []).map((j: { id: string }) => j.id)
    
    if (userJobIds.length === 0) {
      return NextResponse.json({
        transactions: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        filters: { categories: [] },
      })
    }

    // Build query - filter by job_id instead of user_id
    let query = supabase
      .from('categorized_transactions')
      .select('*', { count: 'exact' })
      .in('job_id', jobIdParam ? [jobIdParam] : userJobIds)

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
      query = query.eq('user_confirmed', confirmed === 'true')
    }

    // Apply pagination and sorting
    query = query
      .order('transaction_date', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: transactions, count, error } = await query

    if (error) throw error

    // Get unique categories for filter options (use job_id filter)
    const { data: categories } = await supabase
      .from('categorized_transactions')
      .select('category')
      .in('job_id', userJobIds)
      .not('category', 'is', null)
      .limit(1000)

    const uniqueCategories = [...new Set((categories || []).map((c: any) => c.category))]

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

