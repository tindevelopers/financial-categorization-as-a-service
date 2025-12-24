// @ts-nocheck
'use client'

import { useState } from 'react'
import { Fieldset, Legend, Input, Button, Text } from '@/components/catalyst'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

interface BankAccount {
  name: string
  sortCode: string
  accountNumber: string
  bank: string
}

interface BankAccountsFormProps {
  data: {
    bankAccounts: BankAccount[]
  }
  onChange: (updates: { bankAccounts: BankAccount[] }) => void
}

export function BankAccountsForm({ data, onChange }: BankAccountsFormProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [newAccount, setNewAccount] = useState<BankAccount>({
    name: '',
    sortCode: '',
    accountNumber: '',
    bank: '',
  })

  const handleAdd = () => {
    if (newAccount.name && newAccount.bank) {
      onChange({
        bankAccounts: [...data.bankAccounts, newAccount],
      })
      setNewAccount({ name: '', sortCode: '', accountNumber: '', bank: '' })
      setEditingIndex(null)
    }
  }

  const handleRemove = (index: number) => {
    onChange({
      bankAccounts: data.bankAccounts.filter((_, i) => i !== index),
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <Legend>Bank Accounts (Optional)</Legend>
        <Text className="mt-2">
          Add your business bank accounts for easier reconciliation
        </Text>
      </div>

      <Fieldset>
        {/* Existing Bank Accounts */}
        {data.bankAccounts.length > 0 && (
          <div className="space-y-3 mb-6">
            {data.bankAccounts.map((account, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div>
                  <div className="font-medium">{account.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {account.bank} • {account.sortCode || 'No sort code'} • ••••{account.accountNumber.slice(-4)}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(index)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add New Bank Account */}
        <div className="space-y-4">
          <div>
            <div className="font-medium mb-2">Account Name</div>
            <Input
              value={newAccount.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewAccount({ ...newAccount, name: e.target.value })
              }
              placeholder="e.g., Business Current Account"
            />
          </div>

          <div>
            <div className="font-medium mb-2">Bank Name</div>
            <Input
              value={newAccount.bank}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewAccount({ ...newAccount, bank: e.target.value })
              }
              placeholder="e.g., Barclays"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="font-medium mb-2">Sort Code (Optional)</div>
              <Input
                value={newAccount.sortCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewAccount({ ...newAccount, sortCode: e.target.value })
                }
                placeholder="12-34-56"
              />
            </div>

            <div>
              <div className="font-medium mb-2">Account Number (Optional)</div>
              <Input
                value={newAccount.accountNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewAccount({ ...newAccount, accountNumber: e.target.value })
                }
                placeholder="12345678"
              />
            </div>
          </div>

          <Button
            type="button"
            outline
            onClick={handleAdd}
            disabled={!newAccount.name || !newAccount.bank}
            className="w-full"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Bank Account
          </Button>
        </div>

        {data.bankAccounts.length === 0 && (
          <Text className="mt-4 text-sm text-center text-gray-500 dark:text-gray-400">
            You can skip this step and add bank accounts later
          </Text>
        )}
      </Fieldset>
    </div>
  )
}

