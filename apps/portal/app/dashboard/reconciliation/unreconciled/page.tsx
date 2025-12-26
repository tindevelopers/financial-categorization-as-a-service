'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Heading, Text, Button } from '@/components/catalyst'
import { 
  DocumentTextIcon, 
  BanknotesIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

type Invoice = {
  id: string
  vendor_name?: string
  total_amount?: number
  document_date?: string
  original_filename?: string
  invoice_number?: string
  currency?: string
  created_at: string
  potential_matches?: Match[]
}

type Transaction = {
  id: string
  original_description: string
  amount: number
  date: string
  category?: string
  source_type?: string
  created_at: string
  potential_matches?: Match[]
}

type Match = {
  id: string
  description: string
  amount: number
  date: string
  confidence: 'high' | 'medium' | 'low'
  score: number
  amount_diff: number
  days_diff: number
}

type Summary = {
  total_unreconciled: number
  invoices_count: number
  transactions_count: number
}

export default function UnreconciledPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<Summary>({ 
    total_unreconciled: 0,
    invoices_count: 0,
    transactions_count: 0
  })
  const [loading, setLoading] = useState(true)
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set())
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(new Set())
  const [matchingItems, setMatchingItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadUnreconciledData()
  }, [])

  const loadUnreconciledData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/reconciliation/unreconciled')
      if (!response.ok) throw new Error('Failed to load unreconciled data')
      
      const data = await response.json()
      setInvoices(data.invoices?.items || [])
      setTransactions(data.transactions?.items || [])
      setSummary(data.summary || { 
        total_unreconciled: 0,
        invoices_count: 0,
        transactions_count: 0
      })
    } catch (error) {
      console.error('Error loading unreconciled data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMatch = async (itemId: string, matchId: string, itemType: 'invoice' | 'transaction') => {
    try {
      setMatchingItems(new Set([...matchingItems, itemId]))
      
      // Determine which is transaction and which is document
      let transactionId: string
      let documentId: string
      
      if (itemType === 'invoice') {
        documentId = itemId
        transactionId = matchId
      } else {
        transactionId = itemId
        documentId = matchId
      }

      const response = await fetch('/api/reconciliation/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: transactionId,
          document_id: documentId,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Match failed')
      }
      
      // Reload data
      await loadUnreconciledData()
      setExpandedInvoices(new Set())
      setExpandedTransactions(new Set())
    } catch (error: any) {
      console.error('Match error:', error)
      alert(`Failed to match: ${error.message || 'Unknown error'}`)
    } finally {
      setMatchingItems(new Set())
    }
  }

  const toggleInvoiceExpanded = (invoiceId: string) => {
    const newExpanded = new Set(expandedInvoices)
    if (newExpanded.has(invoiceId)) {
      newExpanded.delete(invoiceId)
    } else {
      newExpanded.add(invoiceId)
    }
    setExpandedInvoices(newExpanded)
  }

  const toggleTransactionExpanded = (transactionId: string) => {
    const newExpanded = new Set(expandedTransactions)
    if (newExpanded.has(transactionId)) {
      newExpanded.delete(transactionId)
    } else {
      newExpanded.add(transactionId)
    }
    setExpandedTransactions(newExpanded)
  }

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    const colors = {
      high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      low: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    }
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[confidence]}`}>
        {confidence}
      </span>
    )
  }

  const formatCurrency = (amount: number | undefined, currency?: string) => {
    if (amount === undefined || amount === null) return 'N/A'
    const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'
    return `${symbol}${Math.abs(amount).toFixed(2)}`
  }

  const formatDate = (date: string | undefined) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <Text className="mt-4 text-gray-600 dark:text-gray-400">Loading unreconciled items...</Text>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Heading>Unreconciled Items</Heading>
        <Text className="mt-2 text-gray-600 dark:text-gray-400">
          Review invoices without transactions and transactions without invoices. Match them manually or let the system suggest matches.
        </Text>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <ExclamationCircleIcon className="h-8 w-8 text-orange-500" />
            <div className="ml-4">
              <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Unreconciled</Text>
              <Text className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total_unreconciled}</Text>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <DocumentTextIcon className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">Invoices Without Transactions</Text>
              <Text className="text-2xl font-bold text-gray-900 dark:text-white">{summary.invoices_count}</Text>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <BanknotesIcon className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">Transactions Without Invoices</Text>
              <Text className="text-2xl font-bold text-gray-900 dark:text-white">{summary.transactions_count}</Text>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices Without Transactions */}
      <div className="mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <Heading level={2} className="text-lg">
              <DocumentTextIcon className="h-5 w-5 inline mr-2 text-blue-500" />
              Invoices Without Transactions ({invoices.length})
            </Heading>
          </div>

          {invoices.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <CheckCircleIcon className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <Text className="text-gray-600 dark:text-gray-400">
                All invoices have matching transactions!
              </Text>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <Text className="font-medium text-gray-900 dark:text-white">
                          {invoice.vendor_name || invoice.original_filename || 'Unknown Vendor'}
                        </Text>
                        {invoice.invoice_number && (
                          <Text className="text-sm text-gray-500 dark:text-gray-400">
                            #{invoice.invoice_number}
                          </Text>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span>{formatCurrency(invoice.total_amount, invoice.currency)}</span>
                        <span>{formatDate(invoice.document_date)}</span>
                        {invoice.potential_matches && invoice.potential_matches.length > 0 && (
                          <span className="text-blue-600 dark:text-blue-400">
                            {invoice.potential_matches.length} potential match(es)
                          </span>
                        )}
                      </div>
                    </div>
                    {invoice.potential_matches && invoice.potential_matches.length > 0 && (
                      <Button
                        onClick={() => toggleInvoiceExpanded(invoice.id)}
                        plain
                      >
                        {expandedInvoices.has(invoice.id) ? 'Hide' : 'Show'} Matches
                      </Button>
                    )}
                  </div>

                  {expandedInvoices.has(invoice.id) && invoice.potential_matches && (
                    <div className="mt-4 pl-4 border-l-2 border-blue-200 dark:border-blue-800">
                      <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Potential Matches:
                      </Text>
                      {invoice.potential_matches.map((match) => (
                        <div
                          key={match.id}
                          className="mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <Text className="font-medium text-gray-900 dark:text-white">
                                {match.description}
                              </Text>
                              {getConfidenceBadge(match.confidence)}
                            </div>
                            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                              Amount: {formatCurrency(match.amount)} | 
                              Date: {formatDate(match.date)} | 
                              Diff: {formatCurrency(match.amount_diff)} / {match.days_diff} days
                            </div>
                          </div>
                          <Button
                            onClick={() => handleMatch(invoice.id, match.id, 'invoice')}
                            disabled={matchingItems.has(invoice.id)}
                            color="blue"
                          >
                            {matchingItems.has(invoice.id) ? 'Matching...' : 'Match'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transactions Without Invoices */}
      <div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <Heading level={2} className="text-lg">
              <BanknotesIcon className="h-5 w-5 inline mr-2 text-green-500" />
              Transactions Without Invoices ({transactions.length})
            </Heading>
          </div>

          {transactions.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <CheckCircleIcon className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <Text className="text-gray-600 dark:text-gray-400">
                All transactions have matching invoices!
              </Text>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <Text className="font-medium text-gray-900 dark:text-white">
                          {transaction.original_description}
                        </Text>
                        {transaction.source_type && (
                          <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                            {transaction.source_type}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span>{formatCurrency(transaction.amount)}</span>
                        <span>{formatDate(transaction.date)}</span>
                        {transaction.category && (
                          <span>{transaction.category}</span>
                        )}
                        {transaction.potential_matches && transaction.potential_matches.length > 0 && (
                          <span className="text-blue-600 dark:text-blue-400">
                            {transaction.potential_matches.length} potential match(es)
                          </span>
                        )}
                      </div>
                    </div>
                    {transaction.potential_matches && transaction.potential_matches.length > 0 && (
                      <Button
                        onClick={() => toggleTransactionExpanded(transaction.id)}
                        plain
                      >
                        {expandedTransactions.has(transaction.id) ? 'Hide' : 'Show'} Matches
                      </Button>
                    )}
                  </div>

                  {expandedTransactions.has(transaction.id) && transaction.potential_matches && (
                    <div className="mt-4 pl-4 border-l-2 border-green-200 dark:border-green-800">
                      <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Potential Matches:
                      </Text>
                      {transaction.potential_matches.map((match) => (
                        <div
                          key={match.id}
                          className="mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <Text className="font-medium text-gray-900 dark:text-white">
                                {match.description}
                              </Text>
                              {getConfidenceBadge(match.confidence)}
                            </div>
                            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                              Amount: {formatCurrency(match.amount)} | 
                              Date: {formatDate(match.date)} | 
                              Diff: {formatCurrency(match.amount_diff)} / {match.days_diff} days
                            </div>
                          </div>
                          <Button
                            onClick={() => handleMatch(transaction.id, match.id, 'transaction')}
                            disabled={matchingItems.has(transaction.id)}
                            color="green"
                          >
                            {matchingItems.has(transaction.id) ? 'Matching...' : 'Match'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Back to Reconciliation */}
      <div className="mt-8">
        <Link href="/dashboard/reconciliation">
          <Button outline>
            ← Back to Reconciliation
          </Button>
        </Link>
      </div>
    </div>
  )
}

