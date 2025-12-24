'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Heading, Text, Button } from '@/components/catalyst'
import { CompanyDetailsForm } from '@/components/setup/CompanyDetailsForm'
import { TaxSettingsForm } from '@/components/setup/TaxSettingsForm'
import { BankAccountsForm } from '@/components/setup/BankAccountsForm'
import { CompletionStep } from '@/components/setup/CompletionStep'

export default function SetupWizardPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [companyProfileId, setCompanyProfileId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    // Company Details
    companyName: '',
    companyType: 'sole_trader' as 'sole_trader' | 'limited_company' | 'partnership' | 'individual',
    companyNumber: '',
    
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
  })

  const totalSteps = 4

  // Load existing company profile data on mount
  useEffect(() => {
    async function loadCompanyProfile() {
      try {
        setLoading(true)
        const response = await fetch('/api/company')
        if (response.ok) {
          const data = await response.json()
          // Get the most recent company profile
          const company = data.companies && data.companies.length > 0 ? data.companies[0] : null
          
          if (company) {
            setCompanyProfileId(company.id)
            // Populate form with existing data
            setFormData({
              companyName: company.company_name || '',
              companyType: company.company_type || 'sole_trader',
              companyNumber: company.company_number || '',
              vatRegistered: company.vat_registered || false,
              vatNumber: company.vat_number || '',
              vatScheme: company.vat_scheme || 'standard',
              flatRatePercentage: company.flat_rate_percentage?.toString() || '',
              financialYearEnd: company.financial_year_end || '',
              accountingBasis: company.accounting_basis || 'cash',
              bankAccounts: company.bank_accounts || [],
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

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to ${companyProfileId ? 'update' : 'create'} company`)
      }

      const data = await response.json()
      
      // Redirect to dashboard
      router.push('/dashboard')
    } catch (error: any) {
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
            <CompanyDetailsForm
              data={formData}
              onChange={(updates) => setFormData({ ...formData, ...updates })}
            />
          )}

          {currentStep === 2 && (
            <TaxSettingsForm
              data={formData}
              onChange={(updates) => setFormData({ ...formData, ...updates })}
            />
          )}

          {currentStep === 3 && (
            <BankAccountsForm
              data={formData}
              onChange={(updates) => setFormData({ ...formData, ...updates })}
            />
          )}

          {currentStep === 4 && (
            <CompletionStep data={formData} />
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
}

declare const formData: FormData

