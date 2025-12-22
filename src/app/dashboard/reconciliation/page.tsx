'use client'

import { useState, useEffect } from 'react'
import { Heading, Text, Button } from '@/components/catalyst'
import { 
  ArrowsRightLeftIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  DocumentTextIcon,
  BanknotesIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'

type Transaction = {
  id: string
  original_description: string
  amount: number
  date: string
  category: string
  reconciliation_status: string
  matched_document_id?: string
  potential_matches?: Document[]
}

type Document = {
  id: string
  original_filename: string
  vendor_name?: string
  total_amount?: number
  invoice_date?: string
  match_confidence?: 'high' | 'medium' | 'low'
  amount_difference?: number
  days_difference?: number
}

type Summary = {
  total_unreconciled: number
  total_matched: number
  total_documents: number
}

export default function ReconciliationPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<Summary>({ 
    total_unreconciled: 0, 
    total_matched: 0,
    total_documents: 0 
  })
  const [loading, setLoading] = useState(true)
  const [autoMatching, setAutoMatching] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null)
  const [matchingTransaction, setMatchingTransaction] = useState<string | null>(null)

  useEffect(() => {
    loadReconciliationData()
  }, [])

  const loadReconciliationData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/reconciliation/candidates')
      if (!response.ok) throw new Error('Failed to load reconciliation data')
      
      const data = await response.json()
      setTransactions(data.transactions || [])
      setSummary(data.summary || { total_unreconciled: 0, total_matched: 0, total_documents: 0 })
    } catch (error) {
      console.error('Error loading reconciliation data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAutoMatch = async () => {
    try {
      setAutoMatching(true)
      const response = await fetch('/api/reconciliation/auto-match', {
        method: 'POST',
      })
      
      if (!response.ok) throw new Error('Auto-match failed')
      
      const data = await response.json()
      alert(`Successfully auto-matched ${data.matched_count} transaction(s)!`)
      
      // Reload data
      await loadReconciliationData()
    } catch (error) {
      console.error('Auto-match error:', error)
      alert('Failed to auto-match transactions')
    } finally {
      setAutoMatching(false)
    }
  }

  const handleMatch = async (transactionId: string, documentId: string) => {
    try {
      setMatchingTransaction(transactionId)
      const response = await fetch('/api/reconciliation/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: transactionId,
          document_id: documentId,
        }),
      })
      
      if (!response.ok) throw new Error('Match failed')
      
      // Reload data
      await loadReconciliationData()
      setSelectedTransaction(null)
    } catch (error) {
      console.error('Match error:', error)
      alert('Failed to match transaction')
    } finally {
      setMatchingTransaction(null)
    }
  }

  const handleUnmatch = async (transactionId: string) => {
    try {
      const response = await fetch(
        `/api/reconciliation/match?transaction_id=${transactionId}`,
        { method: 'DELETE' }
      )
      
      if (!response.ok) throw new Error('Unmatch failed')
      
      // Reload data
      await loadReconciliationData()
    } catch (error) {
      console.error('Unmatch error:', error)
      alert('Failed to unmatch transaction')
    }
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

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Heading>Reconciliation</Heading>
          <Text>Match bank transactions with receipts and invoices</Text>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Heading>Reconciliation</Heading>
          <Text>Match bank transactions with receipts and invoices</Text>
        </div>
        <Button
          color="blue"
          onClick={handleAutoMatch}
          disabled={autoMatching || summary.total_unreconciled === 0}
        >
          <SparklesIcon className="h-5 w-5 mr-2" />
          {autoMatching ? 'Auto-Matching...' : 'Auto-Match'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-yellow-100 dark:bg-yellow-900 rounded-md p-3">
              <BanknotesIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-300" />
            </div>
            <div className="ml-4">
              <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Unreconciled
              </Text>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                {summary.total_unreconciled}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-100 dark:bg-green-900 rounded-md p-3">
              <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-300" />
            </div>
            <div className="ml-4">
              <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Matched
              </Text>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                {summary.total_matched}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900 rounded-md p-3">
              <DocumentTextIcon className="h-6 w-6 text-blue-600 dark:text-blue-300" />
            </div>
            <div className="ml-4">
              <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Documents
              </Text>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                {summary.total_documents}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      {transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-6 mb-4">
            <CheckCircleIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" />
          </div>
          <Heading level={2} className="mb-2">
            All Caught Up!
          </Heading>
          <Text className="max-w-md">
            All your transactions are reconciled. Upload more bank statements or receipts to continue.
          </Text>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Unreconciled Transactions
            </h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-base font-medium text-gray-900 dark:text-white">
                        {tx.original_description}
                      </h4>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(tx.date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mb-3">
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(tx.amount)}
                      </span>
                      {tx.category && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {tx.category}
                        </span>
                      )}
                    </div>

                    {/* Potential Matches */}
                    {tx.potential_matches && tx.potential_matches.length > 0 && (
                      <div className="mt-4">
                        <button
                          onClick={() => setSelectedTransaction(
                            selectedTransaction === tx.id ? null : tx.id
                          )}
                          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                        >
                          {selectedTransaction === tx.id ? 'Hide' : 'Show'} {tx.potential_matches.length} potential match(es)
                        </button>

                        {selectedTransaction === tx.id && (
                          <div className="mt-3 space-y-2">
                            {tx.potential_matches.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                      {doc.vendor_name || doc.original_filename}
                                    </span>
                                    {doc.match_confidence && getConfidenceBadge(doc.match_confidence)}
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                    <span>{formatCurrency(doc.total_amount || 0)}</span>
                                    {doc.invoice_date && <span>{formatDate(doc.invoice_date)}</span>}
                                    {doc.amount_difference !== undefined && (
                                      <span>Diff: {formatCurrency(doc.amount_difference)}</span>
                                    )}
                                    {doc.days_difference !== undefined && (
                                      <span>{Math.round(doc.days_difference)} days apart</span>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  plain
                                  onClick={() => handleMatch(tx.id, doc.id)}
                                  disabled={matchingTransaction === tx.id}
                                >
                                  <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                                  Match
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {tx.potential_matches?.length === 0 && (
                      <Text className="text-sm text-gray-500 dark:text-gray-400">
                        No matching documents found
                      </Text>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
