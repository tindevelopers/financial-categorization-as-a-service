'use client'

import { Heading, Text, Badge, DescriptionList, DescriptionTerm, DescriptionDetails } from '@/components/catalyst'
import { CheckCircleIcon } from '@heroicons/react/24/solid'

interface CompletionStepProps {
  data: {
    companyName: string
    companyType: string
    companyNumber: string
    vatRegistered: boolean
    vatNumber: string
    vatScheme: string
    flatRatePercentage: string
    financialYearEnd: string
    accountingBasis: string
    bankAccounts: Array<{
      name: string
      bank: string
    }>
  }
  setupCompleted?: boolean
}

export function CompletionStep({ data, setupCompleted = false }: CompletionStepProps) {
  const companyTypeLabel = {
    sole_trader: 'Sole Trader',
    limited_company: 'Limited Company',
    partnership: 'Partnership',
    individual: 'Individual',
  }[data.companyType] || data.companyType

  const vatSchemeLabel = {
    standard: 'Standard VAT',
    flat_rate: 'Flat Rate Scheme',
    cash_accounting: 'Cash Accounting',
  }[data.vatScheme] || data.vatScheme

  const accountingBasisLabel = {
    cash: 'Cash Basis',
    accrual: 'Accrual Basis',
  }[data.accountingBasis] || data.accountingBasis

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
          <CheckCircleIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        {setupCompleted ? (
          <>
            <Heading level={2}>Setup Complete</Heading>
            <Text className="mt-2">
              Your company setup has been completed successfully
            </Text>
          </>
        ) : (
          <>
            <Heading level={2}>Almost there!</Heading>
            <Text className="mt-2">
              Please review your details before completing setup
            </Text>
          </>
        )}
      </div>

      {/* Company Details */}
      <div>
        <Heading level={3} className="mb-4">
          Company Details
        </Heading>
        <DescriptionList>
          <DescriptionTerm>Company Name</DescriptionTerm>
          <DescriptionDetails>{data.companyName}</DescriptionDetails>

          <DescriptionTerm>Business Type</DescriptionTerm>
          <DescriptionDetails>{companyTypeLabel}</DescriptionDetails>

          {data.companyNumber && (
            <>
              <DescriptionTerm>Companies House Number</DescriptionTerm>
              <DescriptionDetails>{data.companyNumber}</DescriptionDetails>
            </>
          )}
        </DescriptionList>
      </div>

      {/* Tax & VAT */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <Heading level={3} className="mb-4">
          Tax & VAT Settings
        </Heading>
        <DescriptionList>
          <DescriptionTerm>VAT Registered</DescriptionTerm>
          <DescriptionDetails>
            {data.vatRegistered ? (
              <Badge color="green">Yes</Badge>
            ) : (
              <Badge color="zinc">No</Badge>
            )}
          </DescriptionDetails>

          {data.vatRegistered && (
            <>
              {data.vatNumber && (
                <>
                  <DescriptionTerm>VAT Number</DescriptionTerm>
                  <DescriptionDetails>{data.vatNumber}</DescriptionDetails>
                </>
              )}

              <DescriptionTerm>VAT Scheme</DescriptionTerm>
              <DescriptionDetails>{vatSchemeLabel}</DescriptionDetails>

              {data.vatScheme === 'flat_rate' && data.flatRatePercentage && (
                <>
                  <DescriptionTerm>Flat Rate Percentage</DescriptionTerm>
                  <DescriptionDetails>{data.flatRatePercentage}%</DescriptionDetails>
                </>
              )}
            </>
          )}

          {data.financialYearEnd && (
            <>
              <DescriptionTerm>Financial Year End</DescriptionTerm>
              <DescriptionDetails>
                {new Date(data.financialYearEnd).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                })}
              </DescriptionDetails>
            </>
          )}

          <DescriptionTerm>Accounting Method</DescriptionTerm>
          <DescriptionDetails>{accountingBasisLabel}</DescriptionDetails>
        </DescriptionList>
      </div>

      {/* Bank Accounts */}
      {data.bankAccounts.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <Heading level={3} className="mb-4">
            Bank Accounts
          </Heading>
          <div className="space-y-2">
            {data.bankAccounts.map((account, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
              >
                <div>
                  <div className="font-medium">{account.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {account.bank}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-6">
        <Text className="text-sm">
          By completing setup, you agree that the information provided is accurate. 
          You can update these details anytime in Settings.
        </Text>
      </div>
    </div>
  )
}

