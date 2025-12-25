'use client'

import { Fieldset, Legend, Label, Input, Select, Switch, Text, RadioGroup, Radio, RadioField, Description } from '@/components/catalyst'

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
              <Label>VAT Registered?</Label>
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
                <Label>VAT Registration Number</Label>
                <Input
                  name="vatNumber"
                  value={data.vatNumber}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onChange({ vatNumber: e.target.value })
                  }
                  placeholder="GB123456789"
                  className="mt-2"
                />
              </div>

              {/* VAT Scheme */}
              <div>
                <Label>VAT Scheme</Label>
                <RadioGroup
                  value={data.vatScheme}
                  onChange={(value: string) =>
                    onChange({ vatScheme: value as typeof data.vatScheme })
                  }
                  className="mt-3"
                >
                  <RadioField>
                    <Radio value="standard" />
                    <Label>Standard VAT</Label>
                    <Description>
                      Charge and reclaim VAT on taxable supplies (most common)
                    </Description>
                  </RadioField>
                  <RadioField>
                    <Radio value="flat_rate" />
                    <Label>Flat Rate Scheme</Label>
                    <Description>
                      Pay a fixed percentage of your turnover (simpler admin)
                    </Description>
                  </RadioField>
                  <RadioField>
                    <Radio value="cash_accounting" />
                    <Label>Cash Accounting</Label>
                    <Description>
                      Account for VAT when payment is received/made
                    </Description>
                  </RadioField>
                </RadioGroup>
              </div>

              {/* Flat Rate Percentage (only if flat rate selected) */}
              {data.vatScheme === 'flat_rate' && (
                <div>
                  <Label>Flat Rate Percentage</Label>
                  <div className="mt-2 flex items-center gap-2">
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
            <Label>Financial Year End</Label>
            <Input
              name="financialYearEnd"
              type="date"
              value={data.financialYearEnd}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onChange({ financialYearEnd: e.target.value })
              }
              className="mt-2"
            />
            <Text className="mt-1 text-sm">
              For sole traders, this is typically 5th April (tax year end)
            </Text>
          </div>

          {/* Accounting Basis */}
          <div>
            <Label>Accounting Method</Label>
            <RadioGroup
              value={data.accountingBasis}
              onChange={(value: string) =>
                onChange({ accountingBasis: value as typeof data.accountingBasis })
              }
              className="mt-3"
            >
              <RadioField>
                <Radio value="cash" />
                <Label>Cash Basis</Label>
                <Description>
                  Record income and expenses when money changes hands (simpler for small businesses)
                </Description>
              </RadioField>
              <RadioField>
                <Radio value="accrual" />
                <Label>Accrual Basis</Label>
                <Description>
                  Record income when earned and expenses when incurred (required for larger businesses)
                </Description>
              </RadioField>
            </RadioGroup>
          </div>
        </div>
      </Fieldset>
    </div>
  )
}

