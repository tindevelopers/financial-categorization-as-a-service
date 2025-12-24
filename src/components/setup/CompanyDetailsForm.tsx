// @ts-nocheck
'use client'

import { Fieldset, Legend, Input, Select, Text, Field } from '@/components/catalyst'

interface CompanyDetailsFormProps {
  data: {
    companyName: string
    companyType: 'sole_trader' | 'limited_company' | 'partnership' | 'individual'
    companyNumber: string
  }
  onChange: (updates: Partial<CompanyDetailsFormProps['data']>) => void
}

export function CompanyDetailsForm({ data, onChange }: CompanyDetailsFormProps) {
  return (
    <div className="space-y-6">
      <div>
        <Legend>Company Details</Legend>
        <Text className="mt-2">
          Let&apos;s start with the basics about your business
        </Text>
      </div>

      <Fieldset>
        <div className="space-y-4">
          {/* Company Name */}
          <div>
            <div className="font-medium mb-2">
              Company / Trading Name <span className="text-red-500">*</span>
            </div>
            <Input
              name="companyName"
              value={data.companyName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onChange({ companyName: e.target.value })
              }
              placeholder="e.g., Smith & Co Accounting"
              required
            />
          </div>

          {/* Company Type */}
          <div>
            <div className="font-medium mb-2">Business Type</div>
            <Select
              name="companyType"
              value={data.companyType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                onChange({ companyType: e.target.value as typeof data.companyType })
              }
            >
              <option value="sole_trader">Sole Trader</option>
              <option value="limited_company">Limited Company</option>
              <option value="partnership">Partnership</option>
              <option value="individual">Individual</option>
            </Select>
            <Text className="mt-1 text-sm">
              {data.companyType === 'sole_trader' && 'Self-employed individual trading under their own name or business name'}
              {data.companyType === 'limited_company' && 'Incorporated company registered with Companies House'}
              {data.companyType === 'partnership' && 'Business owned and run by two or more people'}
              {data.companyType === 'individual' && 'Personal finance tracking (not a business)'}
            </Text>
          </div>

          {/* Company Number (only for limited companies) */}
          {data.companyType === 'limited_company' && (
            <div>
              <div className="font-medium mb-2">Companies House Number</div>
              <Input
                name="companyNumber"
                value={data.companyNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onChange({ companyNumber: e.target.value })
                }
                placeholder="e.g., 12345678"
              />
              <Text className="mt-1 text-sm">
                Your 8-digit company registration number from Companies House
              </Text>
            </div>
          )}
        </div>
      </Fieldset>
    </div>
  )
}

