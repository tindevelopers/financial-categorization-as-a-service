'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heading, Text, Button } from '@/components/catalyst'
import { CompanyDetailsForm } from '@/components/setup/CompanyDetailsForm'
import { TaxSettingsForm } from '@/components/setup/TaxSettingsForm'
import { BankAccountsForm } from '@/components/setup/BankAccountsForm'
import { CompletionStep } from '@/components/setup/CompletionStep'

export default function SetupWizardPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
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

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    try {
      const response = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          setupCompleted: true,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create company')
      }

      const data = await response.json()
      
      // Redirect to dashboard
      router.push('/dashboard')
    } catch (error) {
      console.error('Setup error:', error)
      alert('Failed to complete setup. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Heading level={1}>Welcome! Let&apos;s set up your account</Heading>
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

