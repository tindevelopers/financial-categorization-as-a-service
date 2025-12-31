'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Heading, Text, Button } from '@/components/catalyst'
import { CompanyDetailsForm } from '@/components/setup/CompanyDetailsForm'
import { TaxSettingsForm } from '@/components/setup/TaxSettingsForm'
import { BankAccountsForm } from '@/components/setup/BankAccountsForm'
import { GoogleDriveSettings } from '@/components/setup/GoogleDriveSettings'
import { CompletionStep } from '@/components/setup/CompletionStep'
import { ErrorBoundary } from '@/components/ErrorBoundary'

type SubscriptionType = 'individual' | 'company' | 'enterprise'

export default function SetupWizardPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [companyProfileId, setCompanyProfileId] = useState<string | null>(null)
  const [setupCompleted, setSetupCompleted] = useState(false)
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionType>('individual')
  const [formData, setFormData] = useState({
    // Company Details
    companyName: '',
    companyType: 'sole_trader' as 'sole_trader' | 'limited_company' | 'partnership' | 'individual',
    companyNumber: '',
    currency: 'GBP',
    
    // Tax Settings
    vatRegistered: false,
    vatNumber: '',
    vatScheme: 'standard' as 'standard' | 'flat_rate' | 'cash_accounting',
    flatRatePercentage: '',
    financialYearEnd: '',
    accountingBasis: 'cash' as 'cash' | 'accrual',
    
    // Bank Accounts
    bankAccounts: [] as Array<{
      name: string
      sortCode: string
      accountNumber: string
      bank: string
    }>,
    
    // Google Shared Drive Settings
    googleSharedDriveId: null as string | null,
    googleSharedDriveName: null as string | null,
    googleMasterSpreadsheetId: null as string | null,
    googleMasterSpreadsheetName: null as string | null,
    // Enterprise BYO Domain-Wide Delegation
    dwdSubjectEmail: null as string | null,
  })

  const totalSteps = 5

  const handleFormDataChange = useCallback((updates: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...updates }))
  }, [])

  // Load existing company profile data and subscription type on mount
  useEffect(() => {
    async function loadCompanyProfile() {
      try {
        setLoading(true)
        
        // Load subscription type from user's tenant
        try {
          const subResponse = await fetch('/api/tenant-settings')
          if (subResponse.ok) {
            const subData = await subResponse.json()
            if (subData.subscription_type) {
              setSubscriptionType(subData.subscription_type as SubscriptionType)
            }
          }
        } catch (subError) {
          console.error('Error loading subscription type:', subError)
          // Default to individual if we can't load subscription type
        }

        const response = await fetch('/api/company')
        if (response.ok) {
          const data = await response.json()
          // Get the most recent company profile
          const company = data.companies && data.companies.length > 0 ? data.companies[0] : null
          
          if (company) {
            setCompanyProfileId(company.id)
            const isCompleted = company.setup_completed === true
            setSetupCompleted(isCompleted)
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'setup/page.tsx:88',message:'Setup page: Loaded company profile',data:{companyId:company.id,setupCompleted:company.setup_completed,isCompleted},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
            // #endregion
            // If setup is already completed, redirect to dashboard
            if (isCompleted) {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'setup/page.tsx:93',message:'Setup page: Redirecting to dashboard (already completed)',data:{companyId:company.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
              // #endregion
              router.push('/dashboard')
              return
            }
            // Populate form with existing data
            setFormData({
              companyName: company.company_name || '',
              companyType: company.company_type || 'sole_trader',
              companyNumber: company.company_number || '',
              currency: company.default_currency || 'GBP',
              vatRegistered: company.vat_registered || false,
              vatNumber: company.vat_number || '',
              vatScheme: company.vat_scheme || 'standard',
              flatRatePercentage: company.flat_rate_percentage?.toString() || '',
              financialYearEnd: company.financial_year_end || '',
              accountingBasis: company.accounting_basis || 'cash',
              bankAccounts: company.bank_accounts || [],
              // Google Shared Drive settings
              googleSharedDriveId: company.google_shared_drive_id || null,
              googleSharedDriveName: company.google_shared_drive_name || null,
              googleMasterSpreadsheetId: company.google_master_spreadsheet_id || null,
              googleMasterSpreadsheetName: company.google_master_spreadsheet_name || null,
              // Enterprise BYO Domain-Wide Delegation
              dwdSubjectEmail: company.dwd_subject_email || null,
            })
            // Restore the step if saved
            if (company.setup_step) {
              setCurrentStep(company.setup_step)
            }
          }
        }
      } catch (error) {
        console.error('Error loading company profile:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadCompanyProfile()
  }, [])

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'setup/page.tsx:132',message:'handleSubmit called',data:{companyProfileId,hasFormData:!!formData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
      // #endregion
      const method = companyProfileId ? 'PUT' : 'POST'
      const url = '/api/company'
      const body = companyProfileId
        ? {
            id: companyProfileId,
            ...formData,
            setupCompleted: true,
            setupStep: totalSteps,
          }
        : {
            ...formData,
            setupCompleted: true,
            setupStep: totalSteps,
          }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'setup/page.tsx:148',message:'Before API call',data:{method,url,bodySetupCompleted:body.setupCompleted},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
      // #endregion
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.error || `Failed to ${companyProfileId ? 'update' : 'create'} company`,
        )
      }

      const data = await response.json()
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'setup/page.tsx:160',message:'API response received',data:{responseOk:response.ok,setupCompleted:data.company?.setup_completed,companyId:data.company?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
      // #endregion
      
      // Verify setup_completed was actually saved
      if (!data.company?.setup_completed) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'setup/page.tsx:164',message:'ERROR: setup_completed not saved',data:{responseOk:response.ok,setupCompleted:data.company?.setup_completed,companyId:data.company?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        throw new Error('Setup completion was not saved. Please try again.')
      }
      
      // Update local state to show "Setup Complete" before redirect
      setSetupCompleted(true)
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'setup/page.tsx:172',message:'Before redirect to dashboard',data:{setupCompletedState:setupCompleted},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C,E'})}).catch(()=>{});
      // #endregion
      
      // Use window.location instead of router.push to force a full page reload
      // This ensures the middleware sees the updated setup_completed value
      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard'
      } else {
        router.push('/dashboard')
      }
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'setup/page.tsx:169',message:'Setup error',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
      // #endregion
      console.error('Setup error:', error)
      alert(error.message || 'Failed to complete setup. Please try again.')
    }
  }

  // Save progress when moving to next step
  const handleNext = async () => {
    if (currentStep < totalSteps) {
      // Save progress if we have a company profile
      if (companyProfileId) {
        try {
          await fetch('/api/company', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: companyProfileId,
              ...formData,
              setupStep: currentStep + 1,
            }),
          })
        } catch (error) {
          console.error('Error saving progress:', error)
          // Don't block navigation on save error
        }
      }
      setCurrentStep(currentStep + 1)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Text>Loading...</Text>
        </div>
      </div>
    )
  }

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'setup/page.tsx:208',message:'Setup page rendering',data:{currentStep,setupCompleted,loading},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C,E'})}).catch(()=>{});
  }, [currentStep, setupCompleted, loading]);
  // #endregion

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Heading level={1}>
            {companyProfileId ? 'Update Your Company Information' : "Welcome! Let's set up your account"}
          </Heading>
          <Text className="mt-2">
            Step {currentStep} of {totalSteps}
          </Text>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Form Steps */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          {currentStep === 1 && (
            <ErrorBoundary>
              <CompanyDetailsForm
                data={formData}
                onChange={handleFormDataChange}
              />
            </ErrorBoundary>
          )}

          {currentStep === 2 && (
            <ErrorBoundary>
              <TaxSettingsForm
                data={formData}
                onChange={handleFormDataChange}
              />
            </ErrorBoundary>
          )}

          {currentStep === 3 && (
            <ErrorBoundary>
              <BankAccountsForm
                data={formData}
                onChange={handleFormDataChange}
              />
            </ErrorBoundary>
          )}

          {currentStep === 4 && (
            <ErrorBoundary>
              <GoogleDriveSettings
                companyId={companyProfileId || ''}
                initialDriveId={formData.googleSharedDriveId}
                initialDriveName={formData.googleSharedDriveName}
                initialSpreadsheetId={formData.googleMasterSpreadsheetId}
                initialSpreadsheetName={formData.googleMasterSpreadsheetName}
                initialDwdSubjectEmail={formData.dwdSubjectEmail}
                subscriptionType={subscriptionType}
                onChange={handleFormDataChange}
              />
            </ErrorBoundary>
          )}

          {currentStep === 5 && (
            <ErrorBoundary>
              <CompletionStep data={formData} setupCompleted={setupCompleted} />
            </ErrorBoundary>
          )}

          {/* Navigation Buttons */}
          <div className="mt-8 flex justify-between">
            <div>
              {currentStep > 1 && (
                <Button plain onClick={handleBack}>
                  Back
                </Button>
              )}
            </div>

            <div className="flex gap-3">
              {currentStep < totalSteps ? (
                <Button 
                  color="blue" 
                  onClick={handleNext}
                  disabled={!isStepValid(currentStep, formData)}
                >
                  Continue
                </Button>
              ) : (
                <Button color="blue" onClick={handleSubmit}>
                  Complete Setup
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Validation helper
function isStepValid(step: number, data: typeof formData) {
  switch (step) {
    case 1:
      return data.companyName.trim().length > 0
    case 2:
      return true // Tax settings are all optional
    case 3:
      return true // Bank accounts are optional
    case 4:
      return true // Google Drive settings are optional
    case 5:
      return true // Completion step
    default:
      return false
  }
}

// TypeScript workaround for formData type
type FormData = {
  companyName: string
  companyType: 'sole_trader' | 'limited_company' | 'partnership' | 'individual'
  companyNumber: string
  currency: string
  vatRegistered: boolean
  vatNumber: string
  vatScheme: 'standard' | 'flat_rate' | 'cash_accounting'
  flatRatePercentage: string
  financialYearEnd: string
  accountingBasis: 'cash' | 'accrual'
  bankAccounts: Array<{
    name: string
    sortCode: string
    accountNumber: string
    bank: string
  }>
  googleSharedDriveId: string | null
  googleSharedDriveName: string | null
  googleMasterSpreadsheetId: string | null
  googleMasterSpreadsheetName: string | null
  dwdSubjectEmail: string | null
}

declare const formData: FormData

