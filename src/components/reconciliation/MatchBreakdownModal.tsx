'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { Button, Text, Input, Label } from '@/components/catalyst'
import { XMarkIcon, CalculatorIcon } from '@heroicons/react/24/outline'

interface Transaction {
  id: string
  original_description: string
  amount: number
  date: string
  category?: string
}

interface Document {
  id: string
  original_filename: string
  vendor_name?: string
  total_amount?: number
  subtotal_amount?: number
  tax_amount?: number
  fee_amount?: number
  tax_rate?: number
  line_items?: any[]
  document_date?: string
}

interface TaxBreakdown {
  subtotal: number
  tax: number
  fees: number
  net: number
  taxRate: number
  lineItems: any[]
}

interface MatchBreakdownModalProps {
  isOpen: boolean
  transaction: Transaction | null
  document: Document | null
  onConfirm: (breakdown: TaxBreakdown) => Promise<void>
  onCancel: () => void
}

export function MatchBreakdownModal({
  isOpen,
  transaction,
  document,
  onConfirm,
  onCancel,
}: MatchBreakdownModalProps) {
  const [breakdown, setBreakdown] = useState<TaxBreakdown>({
    subtotal: 0,
    tax: 0,
    fees: 0,
    net: 0,
    taxRate: 20,
    lineItems: [],
  })
  const [saving, setSaving] = useState(false)

  // Initialize breakdown from document
  useEffect(() => {
    if (document) {
      const total = document.total_amount || transaction?.amount || 0
      const tax = document.tax_amount || 0
      const fees = document.fee_amount || 0
      const taxRate = document.tax_rate || 20
      
      // Calculate subtotal if not provided
      let subtotal = document.subtotal_amount
      if (!subtotal && total > 0) {
        subtotal = total - tax - fees
      }

      const net = subtotal || (total - tax - fees)

      setBreakdown({
        subtotal: subtotal || net,
        tax,
        fees,
        net,
        taxRate,
        lineItems: document.line_items || [],
      })
    }
  }, [document, transaction])

  // Auto-calculate when tax rate changes
  const handleTaxRateChange = (newRate: number) => {
    const total = document?.total_amount || transaction?.amount || 0
    const fees = breakdown.fees || 0
    
    // Calculate tax from rate
    const taxableAmount = total - fees
    const tax = (taxableAmount * newRate) / (100 + newRate)
    const subtotal = taxableAmount - tax

    setBreakdown(prev => ({
      ...prev,
      taxRate: newRate,
      tax,
      subtotal,
      net: subtotal,
    }))
  }

  // Recalculate net when any field changes
  const handleFieldChange = (field: keyof TaxBreakdown, value: number) => {
    const updated = { ...breakdown, [field]: value }

    // Recalculate net
    if (field === 'subtotal' || field === 'tax' || field === 'fees') {
      updated.net = updated.subtotal
    }

    // Recalculate tax rate if tax or subtotal changes
    if (field === 'tax' || field === 'subtotal') {
      if (updated.subtotal > 0) {
        updated.taxRate = (updated.tax / updated.subtotal) * 100
      }
    }

    setBreakdown(updated)
  }

  const handleConfirm = async () => {
    if (!transaction || !document) return

    try {
      setSaving(true)
      await onConfirm(breakdown)
      onCancel() // Close modal on success
    } catch (error) {
      console.error('Failed to save breakdown:', error)
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  if (!transaction || !document) return null

  return (
    <Dialog open={isOpen} onClose={onCancel} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-4xl w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
            <div className="flex items-center gap-3">
              <CalculatorIcon className="h-6 w-6 text-blue-500" />
              <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                Review Tax Breakdown
              </DialogTitle>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Transaction & Document Details */}
            <div className="grid grid-cols-2 gap-6">
              {/* Transaction Column */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Transaction
                </h3>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Description</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {transaction.original_description}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Amount</dt>
                    <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(transaction.amount)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Date</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">
                      {formatDate(transaction.date)}
                    </dd>
                  </div>
                  {transaction.category && (
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Category</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {transaction.category}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Document Column */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Document
                </h3>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Filename</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {document.original_filename}
                    </dd>
                  </div>
                  {document.vendor_name && (
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Vendor</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {document.vendor_name}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Total Amount</dt>
                    <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(document.total_amount || 0)}
                    </dd>
                  </div>
                  {document.document_date && (
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Date</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {formatDate(document.document_date)}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {/* Tax Breakdown Form */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Tax Breakdown
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Gross Amount (read-only) */}
                <div>
                  <Label>Gross Amount</Label>
                  <Input
                    type="number"
                    value={document.total_amount || transaction.amount}
                    disabled
                    className="bg-gray-100 dark:bg-gray-900"
                  />
                </div>

                {/* VAT Rate */}
                <div>
                  <Label>VAT Rate (%)</Label>
                  <Input
                    type="number"
                    value={breakdown.taxRate}
                    onChange={(e) => handleTaxRateChange(parseFloat(e.target.value) || 0)}
                    step="0.1"
                  />
                </div>

                {/* VAT Amount */}
                <div>
                  <Label>VAT Amount</Label>
                  <Input
                    type="number"
                    value={breakdown.tax.toFixed(2)}
                    onChange={(e) => handleFieldChange('tax', parseFloat(e.target.value) || 0)}
                    step="0.01"
                  />
                </div>

                {/* Fees */}
                <div>
                  <Label>Fees / Charges</Label>
                  <Input
                    type="number"
                    value={breakdown.fees.toFixed(2)}
                    onChange={(e) => handleFieldChange('fees', parseFloat(e.target.value) || 0)}
                    step="0.01"
                  />
                </div>

                {/* Net Amount */}
                <div className="col-span-2">
                  <Label>Net Amount (excl. VAT)</Label>
                  <Input
                    type="number"
                    value={breakdown.net.toFixed(2)}
                    disabled
                    className="bg-gray-100 dark:bg-gray-900 text-lg font-semibold"
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Net Amount:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(breakdown.net)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500 dark:text-gray-400">
                    VAT ({breakdown.taxRate.toFixed(1)}%):
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(breakdown.tax)}
                  </span>
                </div>
                {breakdown.fees > 0 && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-500 dark:text-gray-400">Fees:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(breakdown.fees)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-base font-semibold mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-900 dark:text-white">Total:</span>
                  <span className="text-gray-900 dark:text-white">
                    {formatCurrency(breakdown.net + breakdown.tax + breakdown.fees)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
            <Button plain onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button color="blue" onClick={handleConfirm} disabled={saving}>
              {saving ? 'Saving...' : 'Confirm & Match'}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

