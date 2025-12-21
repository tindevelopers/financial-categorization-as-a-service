// @ts-nocheck
'use client'

import { Fieldset, Legend, Label, Input, Select, Switch, Text, RadioGroup, Radio } from '@/components/catalyst'

interface TaxSettingsFormProps {
  data: {
    vatRegistered: boolean
    vatNumber: string
    vatScheme: 'standard' | 'flat_rate' | 'cash_accounting'
    flatRatePercentage: string
    financialYearEnd: string
    accountingBasis: 'cash' | 'accrual'
  }
  onChange: (updates: Partial<TaxSettingsFormProps['data']>) => void
}

export function TaxSettingsForm({ data, onChange }: TaxSettingsFormProps) {
  return (
    <div className="space-y-6">
      <div>
        <Legend>Tax & VAT Settings</Legend>
        <Text className="mt-2">
          Configure your VAT registration and accounting preferences
        </Text>
      </div>

      <Fieldset>
        <div className="space-y-6">
          {/* VAT Registered */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">VAT Registered?</div>
              <Text className="mt-1 text-sm">
                Are you registered for VAT with HMRC?
              </Text>
            </div>
            <Switch
              checked={data.vatRegistered}
              onChange={(checked: boolean) => onChange({ vatRegistered: checked })}
            />
          </div>

          {/* VAT Details (only if registered) */}
          {data.vatRegistered && (
            <>
              {/* VAT Number */}
              <div>
                <div className="font-medium mb-2">VAT Registration Number</div>
                <Input
                  name="vatNumber"
                  value={data.vatNumber}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onChange({ vatNumber: e.target.value })
                  }
                  placeholder="GB123456789"
                />
              </div>

              {/* VAT Scheme */}
              <div>
                <div className="font-medium mb-3">VAT Scheme</div>
                <RadioGroup
                  value={data.vatScheme}
                  onChange={(value: string) =>
                    onChange({ vatScheme: value as typeof data.vatScheme })
                  }
                >
                  <Radio value="standard">
                    <div>
                      <div className="font-medium">Standard VAT</div>
                      <Text className="text-sm">
                        Charge and reclaim VAT on taxable supplies (most common)
                      </Text>
                    </div>
                  </Radio>
                  <Radio value="flat_rate">
                    <div>
                      <div className="font-medium">Flat Rate Scheme</div>
                      <Text className="text-sm">
                        Pay a fixed percentage of your turnover (simpler admin)
                      </Text>
                    </div>
                  </Radio>
                  <Radio value="cash_accounting">
                    <div>
                      <div className="font-medium">Cash Accounting</div>
                      <Text className="text-sm">
                        Account for VAT when payment is received/made
                      </Text>
                    </div>
                  </Radio>
                </RadioGroup>
              </div>

              {/* Flat Rate Percentage (only if flat rate selected) */}
              {data.vatScheme === 'flat_rate' && (
                <div>
                  <div className="font-medium mb-2">Flat Rate Percentage</div>
                  <div className="flex items-center gap-2">
                    <Input
                      name="flatRatePercentage"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={data.flatRatePercentage}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        onChange({ flatRatePercentage: e.target.value })
                      }
                      placeholder="16.5"
                      className="w-32"
                    />
                    <Text>%</Text>
                  </div>
                  <Text className="mt-1 text-sm">
                    Your flat rate percentage depends on your business sector
                  </Text>
                </div>
              )}
            </>
          )}

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700" />

          {/* Financial Year End */}
          <div>
            <div className="font-medium mb-2">Financial Year End</div>
            <Input
              name="financialYearEnd"
              type="date"
              value={data.financialYearEnd}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onChange({ financialYearEnd: e.target.value })
              }
            />
            <Text className="mt-1 text-sm">
              For sole traders, this is typically 5th April (tax year end)
            </Text>
          </div>

          {/* Accounting Basis */}
          <div>
            <div className="font-medium mb-3">Accounting Method</div>
            <RadioGroup
              value={data.accountingBasis}
              onChange={(value: string) =>
                onChange({ accountingBasis: value as typeof data.accountingBasis })
              }
            >
              <Radio value="cash">
                <div>
                  <div className="font-medium">Cash Basis</div>
                  <Text className="text-sm">
                    Record income and expenses when money changes hands (simpler for small businesses)
                  </Text>
                </div>
              </Radio>
              <Radio value="accrual">
                <div>
                  <div className="font-medium">Accrual Basis</div>
                  <Text className="text-sm">
                    Record income when earned and expenses when incurred (required for larger businesses)
                  </Text>
                </div>
              </Radio>
            </RadioGroup>
          </div>
        </div>
      </Fieldset>
    </div>
  )
}

