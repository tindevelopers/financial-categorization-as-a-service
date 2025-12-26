'use client'

import { Fieldset, Legend, Field, Label, Input, Select, Text } from '@/components/catalyst'

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
      <Fieldset>
        <Legend>Company Details</Legend>
        <Text className="mt-2">
          Let's start with the basics about your business
        </Text>
        <div className="space-y-4">
          {/* Company Name */}
          <Field>
            <Label>
              Company / Trading Name <span className="text-red-500">*</span>
            </Label>
            <Input
              name="companyName"
              value={data.companyName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onChange({ companyName: e.target.value })
              }
              placeholder="e.g., Smith & Co Accounting"
              required
            />
          </Field>

          {/* Company Type */}
          <Field>
            <Label>Business Type</Label>
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
          </Field>

          {/* Company Number (only for limited companies) */}
          {data.companyType === 'limited_company' && (
            <Field>
              <Label>Companies House Number</Label>
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
            </Field>
          )}
        </div>
      </Fieldset>
    </div>
  )
}

