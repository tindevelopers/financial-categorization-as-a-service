'use client'

import { useState, useEffect } from 'react'
import { Heading, Text, Button } from '@/components/catalyst'
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  BuildingLibraryIcon,
  CreditCardIcon,
  BanknotesIcon,
  WalletIcon
} from '@heroicons/react/24/outline'

interface BankAccount {
  id: string
  account_name: string
  account_type: string
  bank_name: string
  sort_code: string | null
  account_number: string | null
  iban: string | null
  currency: string
  spreadsheet_tab_name: string | null
  default_spreadsheet_id: string | null
  is_active: boolean
  created_at: string
}

export default function BankAccountsPage() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    account_name: '',
    account_type: 'checking',
    bank_name: '',
    sort_code: '',
    account_number: '',
    iban: '',
    currency: 'GBP',
    spreadsheet_tab_name: '',
    default_spreadsheet_id: '',
  })

  useEffect(() => {
    fetchBankAccounts()
  }, [])

  const fetchBankAccounts = async () => {
    try {
      const response = await fetch('/api/bank-accounts?include_inactive=true')
      const data = await response.json()
      if (data.success) {
        setBankAccounts(data.bank_accounts || [])
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        sort_code: formData.sort_code || null,
        account_number: formData.account_number || null,
        iban: formData.iban || null,
        spreadsheet_tab_name: formData.spreadsheet_tab_name || null,
        default_spreadsheet_id: formData.default_spreadsheet_id || null,
      }

      if (editingId) {
        const response = await fetch(`/api/bank-accounts/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error('Failed to update bank account')
      } else {
        const response = await fetch('/api/bank-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error('Failed to create bank account')
      }

      await fetchBankAccounts()
      resetForm()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const handleEdit = (account: BankAccount) => {
    setEditingId(account.id)
    setFormData({
      account_name: account.account_name,
      account_type: account.account_type,
      bank_name: account.bank_name,
      sort_code: account.sort_code || '',
      account_number: account.account_number || '',
      iban: account.iban || '',
      currency: account.currency,
      spreadsheet_tab_name: account.spreadsheet_tab_name || '',
      default_spreadsheet_id: account.default_spreadsheet_id || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bank account?')) {
      return
    }

    try {
      const response = await fetch(`/api/bank-accounts/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete bank account')
      await fetchBankAccounts()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const resetForm = () => {
    setFormData({
      account_name: '',
      account_type: 'checking',
      bank_name: '',
      sort_code: '',
      account_number: '',
      iban: '',
      currency: 'GBP',
      spreadsheet_tab_name: '',
      default_spreadsheet_id: '',
    })
    setEditingId(null)
    setShowForm(false)
  }

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'credit_card':
        return CreditCardIcon
      case 'savings':
        return WalletIcon
      case 'business':
        return BuildingLibraryIcon
      default:
        return BanknotesIcon
    }
  }

  const activeAccounts = bankAccounts.filter(acc => acc.is_active)
  const inactiveAccounts = bankAccounts.filter(acc => !acc.is_active)

  const handleResetTenant = async () => {
    if (!confirm('This will delete all uploads, documents, and transactions for your tenant. Continue?')) return
    if (!confirm('Final confirmation: delete ALL storage (including archived) for this tenant?')) return
    try {
      const res = await fetch('/api/categorization/reset', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Reset failed')
      alert('Reset completed.')
      await fetchBankAccounts()
    } catch (error: any) {
      alert(`Reset failed: ${error.message}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading>Bank Accounts</Heading>
          <Text className="mt-2">
            Manage your bank accounts and link them to spreadsheets
          </Text>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <PlusIcon className="h-5 w-5" />
          Add Bank Account
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit Bank Account' : 'Add Bank Account'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Account Type *
                </label>
                <select
                  required
                  value={formData.account_type}
                  onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="business">Business</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Bank Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="GBP">GBP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Sort Code
                </label>
                <input
                  type="text"
                  value={formData.sort_code}
                  onChange={(e) => setFormData({ ...formData, sort_code: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="12-34-56"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Account Number
                </label>
                <input
                  type="text"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Last 4 digits"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  IBAN
                </label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Spreadsheet Tab Name
                </label>
                <input
                  type="text"
                  value={formData.spreadsheet_tab_name}
                  onChange={(e) => setFormData({ ...formData, spreadsheet_tab_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Defaults to account name"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Default Spreadsheet ID *
                </label>
                <input
                  type="text"
                  required
                  value={formData.default_spreadsheet_id}
                  onChange={(e) => setFormData({ ...formData, default_spreadsheet_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Google Sheets spreadsheet ID"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit">
                {editingId ? 'Update' : 'Create'} Bank Account
              </Button>
              <Button type="button" onClick={resetForm} color="zinc">
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Bank Accounts List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      ) : (
        <>
          {activeAccounts.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <Heading level={3}>Active Accounts</Heading>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {activeAccounts.map((account) => {
                  const Icon = getAccountTypeIcon(account.account_type)
                  return (
                    <div key={account.id} className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Icon className="h-8 w-8 text-gray-400" />
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {account.account_name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {account.bank_name} • {account.account_type.replace('_', ' ')}
                            {account.sort_code && ` • Sort Code: ${account.sort_code}`}
                            {account.account_number && ` • Account: ****${account.account_number}`}
                          </div>
                          {account.default_spreadsheet_id && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              Spreadsheet: {account.default_spreadsheet_id.substring(0, 20)}...
                              {account.spreadsheet_tab_name && ` (Tab: ${account.spreadsheet_tab_name})`}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => handleEdit(account)} color="zinc" className="gap-1">
                          <PencilIcon className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button onClick={() => handleDelete(account.id)} color="red" className="gap-1">
                          <TrashIcon className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeAccounts.length === 0 && !loading && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
              <BanknotesIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <Text className="mb-4">No bank accounts yet</Text>
              <Button onClick={() => setShowForm(true)}>
                <PlusIcon className="h-5 w-5 mr-2" />
                Add Your First Bank Account
              </Button>
            </div>
          )}

          {/* Tenant reset */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Reset Storage & Documents</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Deletes all uploads, documents, transactions, and stored files (including archived) for this tenant.
            </p>
            <Button onClick={handleResetTenant} color="red" className="gap-2">
              <TrashIcon className="h-4 w-4" />
              Reset Tenant Storage
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

