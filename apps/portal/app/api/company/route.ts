import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database/server'

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

    // Transform bank accounts from camelCase to snake_case
    const bankAccounts = (body.bankAccounts || []).map((account: any) => ({
      name: account.name,
      sort_code: account.sortCode || account.sort_code,
      account_number: account.accountNumber || account.account_number,
      bank: account.bank,
    }))

    // Create company profile
    const { data: company, error: insertError } = await supabase
      .from('company_profiles')
      .insert({
        user_id: user.id,
        tenant_id: userData?.tenant_id || null,
        company_name: body.companyName,
        company_type: body.companyType,
        company_number: body.companyNumber || null,
        default_currency: body.currency || 'GBP',
        vat_registered: body.vatRegistered || false,
        vat_number: body.vatNumber || null,
        vat_scheme: body.vatScheme || null,
        flat_rate_percentage: body.flatRatePercentage
          ? parseFloat(body.flatRatePercentage)
          : null,
        financial_year_end: body.financialYearEnd || null,
        accounting_basis: body.accountingBasis || 'cash',
        bank_accounts: bankAccounts,
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

    // Transform bank accounts from snake_case to camelCase for frontend
    const transformedCompanies = companies?.map((company: any) => ({
      ...company,
      bank_accounts: (company.bank_accounts || []).map((account: any) => ({
        name: account.name,
        sortCode: account.sort_code || account.sortCode,
        accountNumber: account.account_number || account.accountNumber,
        bank: account.bank,
      })),
    })) || []

    return NextResponse.json({ companies: transformedCompanies })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/company/route.ts:PUT:entry',message:'PUT handler called',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
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
    const { id, ...updateData } = body
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/company/route.ts:PUT:bodyParsed',message:'Request body parsed',data:{id,setupCompleted:updateData.setupCompleted,setupStep:updateData.setupStep,hasSetupCompleted:updateData.setupCompleted!==undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (!id) {
      return NextResponse.json(
        { error: 'Company profile ID is required' },
        { status: 400 }
      )
    }

    // Verify the company profile belongs to the user
    const { data: existingCompany, error: fetchError } = await supabase
      .from('company_profiles')
      .select('id, user_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingCompany) {
      return NextResponse.json(
        { error: 'Company profile not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updatePayload: any = {}
    // Only update company_name if it's provided and not empty
    if (updateData.companyName !== undefined && updateData.companyName && updateData.companyName.trim() !== '') {
      updatePayload.company_name = updateData.companyName.trim()
    } else if (updateData.companyName !== undefined && (!updateData.companyName || updateData.companyName.trim() === '')) {
      // Reject empty company names
      return NextResponse.json(
        { error: 'Company name cannot be empty' },
        { status: 400 }
      )
    }
    if (updateData.companyType !== undefined) updatePayload.company_type = updateData.companyType
    if (updateData.companyNumber !== undefined) updatePayload.company_number = updateData.companyNumber || null
    if (updateData.currency !== undefined) updatePayload.default_currency = updateData.currency || 'GBP'
    if (updateData.vatRegistered !== undefined) updatePayload.vat_registered = updateData.vatRegistered
    if (updateData.vatNumber !== undefined) updatePayload.vat_number = updateData.vatNumber || null
    if (updateData.vatScheme !== undefined) updatePayload.vat_scheme = updateData.vatScheme || null
    if (updateData.flatRatePercentage !== undefined) {
      updatePayload.flat_rate_percentage = updateData.flatRatePercentage
        ? parseFloat(updateData.flatRatePercentage)
        : null
    }
    if (updateData.financialYearEnd !== undefined) updatePayload.financial_year_end = updateData.financialYearEnd || null
    if (updateData.accountingBasis !== undefined) updatePayload.accounting_basis = updateData.accountingBasis
    if (updateData.bankAccounts !== undefined) {
      // Transform bank accounts from camelCase to snake_case
      updatePayload.bank_accounts = (updateData.bankAccounts || []).map((account: any) => ({
        name: account.name,
        sort_code: account.sortCode || account.sort_code,
        account_number: account.accountNumber || account.account_number,
        bank: account.bank,
      }))
    }
    if (updateData.setupCompleted !== undefined) updatePayload.setup_completed = updateData.setupCompleted
    if (updateData.setupStep !== undefined) updatePayload.setup_step = updateData.setupStep
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/company/route.ts:PUT:beforeUpdate',message:'Update payload constructed',data:{updatePayload,setupCompletedInPayload:updatePayload.setup_completed,setupStepInPayload:updatePayload.setup_step},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Update company profile
    const { data: company, error: updateError } = await supabase
      .from('company_profiles')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/company/route.ts:PUT:afterUpdate',message:'Database update result',data:{hasError:!!updateError,errorMessage:updateError?.message,companySetupCompleted:company?.setup_completed,companyId:company?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (updateError) {
      console.error('Company update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update company', details: updateError.message },
        { status: 500 }
      )
    }

    // Transform bank accounts from snake_case to camelCase for response
    const transformedCompany = company ? {
      ...company,
      bank_accounts: (company.bank_accounts || []).map((account: any) => ({
        name: account.name,
        sortCode: account.sort_code || account.sortCode,
        accountNumber: account.account_number || account.accountNumber,
        bank: account.bank,
      })),
    } : company
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/app/api/company/route.ts:PUT:beforeReturn',message:'About to return response',data:{transformedCompanySetupCompleted:transformedCompany?.setup_completed,transformedCompanyId:transformedCompany?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    return NextResponse.json({ success: true, company: transformedCompany }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

