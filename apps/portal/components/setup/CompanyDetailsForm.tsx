'use client'

import { Fieldset, Legend, Field, Label, Input, Select, Text } from '@/components/catalyst'

interface CompanyDetailsFormProps {
  data: {
    companyName: string
    companyType: 'sole_trader' | 'limited_company' | 'partnership' | 'individual'
    companyNumber: string
    currency: string
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

          {/* Currency */}
          <Field>
            <Label>Default Currency</Label>
            <Select
              name="currency"
              value={data.currency}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                onChange({ currency: e.target.value })
              }
            >
              <option value="GBP">GBP - British Pound (£)</option>
              <option value="USD">USD - US Dollar ($)</option>
              <option value="EUR">EUR - Euro (€)</option>
              <option value="CAD">CAD - Canadian Dollar (C$)</option>
              <option value="AUD">AUD - Australian Dollar (A$)</option>
              <option value="JPY">JPY - Japanese Yen (¥)</option>
              <option value="CHF">CHF - Swiss Franc (CHF)</option>
              <option value="CNY">CNY - Chinese Yuan (¥)</option>
              <option value="INR">INR - Indian Rupee (₹)</option>
              <option value="NZD">NZD - New Zealand Dollar (NZ$)</option>
              <option value="SGD">SGD - Singapore Dollar (S$)</option>
              <option value="HKD">HKD - Hong Kong Dollar (HK$)</option>
              <option value="SEK">SEK - Swedish Krona (kr)</option>
              <option value="NOK">NOK - Norwegian Krone (kr)</option>
              <option value="DKK">DKK - Danish Krone (kr)</option>
              <option value="PLN">PLN - Polish Zloty (zł)</option>
              <option value="ZAR">ZAR - South African Rand (R)</option>
              <option value="BRL">BRL - Brazilian Real (R$)</option>
              <option value="MXN">MXN - Mexican Peso ($)</option>
            </Select>
            <Text className="mt-1 text-sm">
              The primary currency for your financial transactions and reports
            </Text>
          </Field>
        </div>
      </Fieldset>
    </div>
  )
}

