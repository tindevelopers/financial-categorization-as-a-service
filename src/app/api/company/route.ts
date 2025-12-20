import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/core/database/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Get user's tenant_id if they have one
    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    // Create company profile
    const { data: company, error: insertError } = await supabase
      .from('company_profiles')
      .insert({
        user_id: user.id,
        tenant_id: userData?.tenant_id || null,
        company_name: body.companyName,
        company_type: body.companyType,
        company_number: body.companyNumber || null,
        vat_registered: body.vatRegistered || false,
        vat_number: body.vatNumber || null,
        vat_scheme: body.vatScheme || null,
        flat_rate_percentage: body.flatRatePercentage
          ? parseFloat(body.flatRatePercentage)
          : null,
        financial_year_end: body.financialYearEnd || null,
        accounting_basis: body.accountingBasis || 'cash',
        bank_accounts: body.bankAccounts || [],
        setup_completed: body.setupCompleted || false,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Company creation error:', insertError)
      return NextResponse.json(
        { error: 'Failed to create company' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, company }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all company profiles for the user
    const { data: companies, error } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching companies:', error)
      return NextResponse.json(
        { error: 'Failed to fetch companies' },
        { status: 500 }
      )
    }

    return NextResponse.json({ companies })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

