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

    // Enterprise-targeted instrumentation (safe for serverless; only logs when enabled)
    if (process.env.DEBUG_ENTERPRISE === "1" && user.email?.endsWith("@velocitypartners.info")) {
      console.log("[api/company][enterprise] POST before insert", {
        userId: user.id,
        tenantId: userData?.tenant_id ?? null,
        setupCompleted: body.setupCompleted,
      })
    }
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
        // Google Shared Drive settings
        google_shared_drive_id: body.googleSharedDriveId || null,
        google_shared_drive_name: body.googleSharedDriveName || null,
        google_master_spreadsheet_id: body.googleMasterSpreadsheetId || null,
        google_master_spreadsheet_name: body.googleMasterSpreadsheetName || null,
      })
      .select()
      .single()

    if (process.env.DEBUG_ENTERPRISE === "1" && user.email?.endsWith("@velocitypartners.info")) {
      console.log("[api/company][enterprise] POST after insert", {
        userId: user.id,
        hasError: !!insertError,
        error: insertError?.message,
        companyId: company?.id,
        companySetupCompleted: company?.setup_completed,
      })
    }
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

    // Get user's tenant_id
    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single()
    
    // Fetch dwdSubjectEmail from tenant_integration_settings if available
    let dwdSubjectEmail: string | null = null
    if (userData?.tenant_id) {
      const { data: integrationSettings } = await supabase
        .from('tenant_integration_settings')
        .select('settings')
        .eq('tenant_id', userData.tenant_id)
        .eq('provider', 'google_sheets')
        .single()
      
      if (integrationSettings?.settings) {
        dwdSubjectEmail = (integrationSettings.settings as any).dwdSubjectEmail || null
      }
    }

    // Transform bank accounts from snake_case to camelCase for frontend
    const transformedCompanies = companies?.map((company: any) => ({
      ...company,
      dwd_subject_email: dwdSubjectEmail,
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

export async function PUT(request: NextRequest) {  try {
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
    // Google Shared Drive settings
    if (updateData.googleSharedDriveId !== undefined) updatePayload.google_shared_drive_id = updateData.googleSharedDriveId || null
    if (updateData.googleSharedDriveName !== undefined) updatePayload.google_shared_drive_name = updateData.googleSharedDriveName || null
    if (updateData.googleMasterSpreadsheetId !== undefined) updatePayload.google_master_spreadsheet_id = updateData.googleMasterSpreadsheetId || null
    if (updateData.googleMasterSpreadsheetName !== undefined) updatePayload.google_master_spreadsheet_name = updateData.googleMasterSpreadsheetName || null
    
    // Handle dwdSubjectEmail - save to tenant_integration_settings
    if (updateData.dwdSubjectEmail !== undefined) {
      // Get user's tenant_id
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single()
      
      if (userData?.tenant_id) {
        // Upsert tenant_integration_settings with dwdSubjectEmail
        const { error: settingsError } = await supabase
          .from('tenant_integration_settings')
          .upsert({
            tenant_id: userData.tenant_id,
            provider: 'google_sheets',
            settings: {
              dwdSubjectEmail: updateData.dwdSubjectEmail || null,
              googleIntegrationTier: 'enterprise_byo',
            },
            use_custom_credentials: true,
          }, {
            onConflict: 'tenant_id,provider',
            ignoreDuplicates: false,
          })
        
        if (settingsError) {
          console.error('Error saving dwdSubjectEmail to tenant_integration_settings:', settingsError)
          // Don't fail the whole request, just log the error
        }
      }
    }
    
    // Ensure updatePayload is not empty - if setupCompleted is being set, make sure it's included
    if (Object.keys(updatePayload).length === 0 && updateData.setupCompleted !== undefined) {
      updatePayload.setup_completed = updateData.setupCompleted
    }
    
    if (process.env.DEBUG_ENTERPRISE === "1" && user.email?.endsWith("@velocitypartners.info")) {
      console.log("[api/company][enterprise] PUT about to update", {
        userId: user.id,
        companyId: id,
        updatePayloadKeys: Object.keys(updatePayload),
        setupCompleted: updatePayload.setup_completed,
      })
    }
    
    // Update company profile
    const { data: company, error: updateError } = await supabase
      .from('company_profiles')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (process.env.DEBUG_ENTERPRISE === "1" && user.email?.endsWith("@velocitypartners.info")) {
      console.log("[api/company][enterprise] PUT after update", {
        userId: user.id,
        companyId: company?.id,
        hasError: !!updateError,
        error: updateError?.message,
        companySetupCompleted: company?.setup_completed,
      })
    }
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
    if (process.env.DEBUG_ENTERPRISE === "1" && user.email?.endsWith("@velocitypartners.info")) {
      console.log("[api/company][enterprise] PUT returning", {
        userId: user.id,
        transformedCompanySetupCompleted: (transformedCompany as any)?.setup_completed,
      })
    }
    return NextResponse.json({ success: true, company: transformedCompany }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

