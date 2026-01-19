'use client'

import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Heading, Text, Button } from '@/components/catalyst'
import { 
  ArrowsRightLeftIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  DocumentTextIcon,
  BanknotesIcon,
  SparklesIcon,
  EnvelopeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PaperClipIcon,
  LinkIcon
} from '@heroicons/react/24/outline'
import { ReceiptUploadModal } from '@/components/reconciliation/ReceiptUploadModal'
import { MatchBreakdownModal } from '@/components/reconciliation/MatchBreakdownModal'
import { EmailForwardingInfo } from '@/components/reconciliation/EmailForwardingInfo'

type Transaction = {
  id: string
  original_description: string
  amount: number
  date: string
  category: string
  subcategory?: string
  reconciliation_status: string
  matched_document_id?: string
  matched_document?: Document
  potential_matches?: Document[]
  user_notes?: string
  job?: {
    id: string
    original_filename: string
    created_at: string
  }
}

type Document = {
  id: string
  original_filename: string
  vendor_name?: string
  total_amount?: number
  invoice_date?: string
  document_date?: string
  file_type?: string
  mime_type?: string
  match_confidence?: 'high' | 'medium' | 'low'
  amount_difference?: number
  days_difference?: number
  extracted_text?: string
  extracted_data?: any
  category?: string
  subcategory?: string
  tags?: string[]
  description?: string
  notes?: string
  supabase_path?: string
  storage_tier?: string
}

type Summary = {
  total_unreconciled: number
  total_matched: number
  total_documents: number
}

type BankAccount = {
  id: string
  account_name: string
  bank_name: string
  account_type: string
}

const KNOWN_PROCESSORS: Array<{ slug: string; label: string }> = [
  { slug: 'stripe', label: 'Stripe' },
  { slug: 'paypal', label: 'PayPal' },
  { slug: 'booking', label: 'Booking.com' },
  { slug: 'expedia', label: 'Expedia' },
  { slug: 'airbnb', label: 'Airbnb' },
  { slug: 'vrbo', label: 'VRBO' },
  { slug: 'lodgify', label: 'Lodgify' },
]

export default function ReconciliationPage() {
  const searchParams = useSearchParams()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<Summary>({ 
    total_unreconciled: 0, 
    total_matched: 0,
    total_documents: 0 
  })
  const [loading, setLoading] = useState(true)
  const [autoMatching, setAutoMatching] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null)
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(new Set())
  const [matchingTransaction, setMatchingTransaction] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'unreconciled' | 'matched'>('all')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showEmailInfo, setShowEmailInfo] = useState(false)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | 'all'>('all')
  const [selectedProcessor, setSelectedProcessor] = useState<string | 'all'>('all')
  const [breakdownModal, setBreakdownModal] = useState<{
    show: boolean
    transaction: Transaction | null
    document: Document | null
  }>({ show: false, transaction: null, document: null })


  // Initialize scope from query params (Statements -> Reconciliation)
  useEffect(() => {
    const bankAccountId = searchParams.get('bank_account_id')
    const processor = searchParams.get('processor')
    if (bankAccountId) {
      setSelectedBankAccountId(bankAccountId)
      setSelectedProcessor('all')
      return
    }
    if (processor) {
      setSelectedProcessor(processor)
      setSelectedBankAccountId('all')
    }
  }, [searchParams])

  const fetchBankAccounts = async () => {
    try {
      const resp = await fetch('/api/bank-accounts?include_inactive=true')
      if (!resp.ok) throw new Error('Failed to fetch bank accounts')
      const data = await resp.json()
      setBankAccounts(data.bank_accounts || [])
    } catch (error) {
      console.error('Error fetching bank accounts:', error)
      setBankAccounts([])
    }
  }

  useEffect(() => {
    fetchBankAccounts()
  }, [])

  const loadReconciliationData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }
      if (selectedBankAccountId !== 'all') {
        params.set('bank_account_id', selectedBankAccountId)
      } else if (selectedProcessor !== 'all') {
        params.set('processor', selectedProcessor)
      }
      const response = await fetch(`/api/reconciliation/candidates?${params.toString()}`)
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

  useEffect(() => {
    loadReconciliationData()
  }, [statusFilter, selectedBankAccountId, selectedProcessor])

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
    // Find transaction and document
    const transaction = transactions.find(t => t.id === transactionId)
    if (!transaction) return

    const document = transaction.potential_matches?.find(d => d.id === documentId)
    if (!document) return

    // Open breakdown modal
    setBreakdownModal({
      show: true,
      transaction,
      document,
    })
  }

  const handleConfirmBreakdown = async (breakdown: any) => {
    if (!breakdownModal.transaction || !breakdownModal.document) return

    try {
      setMatchingTransaction(breakdownModal.transaction.id)
      const response = await fetch('/api/reconciliation/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: breakdownModal.transaction.id,
          document_id: breakdownModal.document.id,
          breakdown: {
            subtotal: breakdown.subtotal,
            tax: breakdown.tax,
            fees: breakdown.fees,
            net: breakdown.net,
            taxRate: breakdown.taxRate,
            lineItems: breakdown.lineItems,
          },
        }),
      })
      
      if (!response.ok) throw new Error('Match failed')
      
      // Reload data
      await loadReconciliationData()
      setSelectedTransaction(null)
      setBreakdownModal({ show: false, transaction: null, document: null })
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

  const toggleExpand = (transactionId: string) => {
    setExpandedTransactions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId)
      } else {
        newSet.add(transactionId)
      }
      return newSet
    })
  }

  const getDocumentTypeLabel = (fileType?: string) => {
    const labels: Record<string, string> = {
      'bank_statement': 'Bank Statement',
      'receipt': 'Receipt',
      'invoice': 'Invoice',
      'tax_document': 'Tax Document',
      'shares': 'Share Certificate',
      'loan_agreement': 'Loan Agreement',
      'capital_stock': 'Capital Stock Document',
      'other': 'Other Document'
    }
    return labels[fileType || 'other'] || 'Document'
  }

  const handleViewDocument = async (documentId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const response = await fetch(`/api/documents/${documentId}`)
      const data = await response.json()
      if (data.document?.downloadUrl) {
        window.open(data.document.downloadUrl, '_blank', 'noopener,noreferrer')
      } else if (data.document?.archiveStatus?.isRestoring) {
        alert('This document is being restored from archive. Please check back later.')
      } else {
        alert('Document is not available for viewing at this time.')
      }
    } catch (error) {
      console.error('Error fetching document URL:', error)
      alert('Failed to load document')
    }
  }

  const handleUploadComplete = async (documentIds: string[]) => {
    console.log(`Uploaded ${documentIds.length} documents`)
    setShowUploadModal(false)
    // Reload reconciliation data to include new documents
    await loadReconciliationData()
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

  const bankAccountsById = useMemo(() => new Map(bankAccounts.map((a) => [a.id, a])), [bankAccounts])
  const activeScopeLabel = useMemo(() => {
    if (selectedBankAccountId !== 'all') {
      const acct = bankAccountsById.get(selectedBankAccountId)
      return acct ? `${acct.account_name} (${acct.bank_name})` : 'Selected account'
    }
    if (selectedProcessor !== 'all') {
      return KNOWN_PROCESSORS.find((p) => p.slug === selectedProcessor)?.label || selectedProcessor
    }
    return 'All accounts'
  }, [bankAccountsById, selectedBankAccountId, selectedProcessor])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Heading>Reconciliation</Heading>
          <Text>Match bank transactions with receipts and invoices</Text>
        </div>
        <div className="flex gap-2">
          <Button
            color="blue"
            onClick={handleAutoMatch}
            disabled={autoMatching || summary.total_unreconciled === 0}
          >
            <SparklesIcon className="h-5 w-5 mr-2" />
            {autoMatching ? 'Auto-Matching...' : 'Auto-Match'}
          </Button>
          <Button outline onClick={() => setShowUploadModal(true)}>
            <DocumentTextIcon className="h-5 w-5 mr-2" />
            Upload Receipts
          </Button>
          <Button outline onClick={() => setShowEmailInfo(true)}>
            <EnvelopeIcon className="h-5 w-5 mr-2" />
            Email Address
          </Button>
        </div>
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

      {/* Account scope filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex-1 max-w-xl">
            <Text className="text-sm text-gray-500 dark:text-gray-400">Scope</Text>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <select
                value={selectedBankAccountId}
                onChange={(e) => {
                  const v = e.target.value
                  setSelectedBankAccountId(v as any)
                  if (v !== 'all') setSelectedProcessor('all')
                }}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                <option value="all">All bank/credit-card accounts</option>
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_name} ({a.bank_name})
                  </option>
                ))}
              </select>

              <select
                value={selectedProcessor}
                onChange={(e) => {
                  const v = e.target.value
                  setSelectedProcessor(v as any)
                  if (v !== 'all') setSelectedBankAccountId('all')
                }}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                <option value="all">All processors</option>
                {KNOWN_PROCESSORS.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Viewing: <span className="font-medium">{activeScopeLabel}</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            statusFilter === 'all'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          All Transactions
        </button>
        <button
          onClick={() => setStatusFilter('unreconciled')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            statusFilter === 'unreconciled'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Unreconciled ({summary.total_unreconciled})
        </button>
        <button
          onClick={() => setStatusFilter('matched')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            statusFilter === 'matched'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Matched ({summary.total_matched})
        </button>
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
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {transactions.map((tx) => {
              const isExpanded = expandedTransactions.has(tx.id)
              const isMatched = tx.reconciliation_status === 'matched'
              const hasMatchedDoc = !!tx.matched_document
              
              return (
                <div key={tx.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-900">
                  {/* Main Transaction Row */}
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => toggleExpand(tx.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleExpand(tx.id)
                            }}
                            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            {isExpanded ? (
                              <ChevronUpIcon className="h-5 w-5" />
                            ) : (
                              <ChevronDownIcon className="h-5 w-5" />
                            )}
                          </button>
                          <h4 className="text-base font-medium text-gray-900 dark:text-white truncate">
                            {tx.original_description}
                          </h4>
                          <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
                            {formatDate(tx.date)}
                          </span>
                          {isMatched && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex-shrink-0">
                              <CheckCircleIcon className="h-3 w-3 mr-1" />
                              Matched
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 ml-8">
                          <span className="text-lg font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(tx.amount)}
                          </span>
                          {tx.category && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {tx.category}
                              {tx.subcategory && ` / ${tx.subcategory}`}
                            </span>
                          )}
                          {hasMatchedDoc && (
                            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <PaperClipIcon className="h-4 w-4" />
                              {getDocumentTypeLabel(tx.matched_document?.file_type)}
                            </span>
                          )}
                        </div>
                      </div>
                      {isMatched && hasMatchedDoc && (
                        <div className="ml-4 flex-shrink-0">
                          <Button
                            plain
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUnmatch(tx.id)
                            }}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <XCircleIcon className="h-5 w-5" />
                            Unmatch
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 ml-8 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      <div className="pt-4 space-y-4">
                        {/* Transaction Details */}
                        <div>
                          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Financial Transaction
                          </h5>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Description:</span>
                              <span className="ml-2 text-gray-900 dark:text-white">{tx.original_description}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                              <span className="ml-2 text-gray-900 dark:text-white font-semibold">{formatCurrency(tx.amount)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Date:</span>
                              <span className="ml-2 text-gray-900 dark:text-white">{formatDate(tx.date)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Category:</span>
                              <span className="ml-2 text-gray-900 dark:text-white">{tx.category || 'Uncategorized'}</span>
                            </div>
                            {tx.subcategory && (
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Subcategory:</span>
                                <span className="ml-2 text-gray-900 dark:text-white">{tx.subcategory}</span>
                              </div>
                            )}
                            {tx.job && (
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Source:</span>
                                <span className="ml-2 text-gray-900 dark:text-white">{tx.job.original_filename}</span>
                              </div>
                            )}
                            {tx.user_notes && (
                              <div className="col-span-2">
                                <span className="text-gray-500 dark:text-gray-400">Notes:</span>
                                <span className="ml-2 text-gray-900 dark:text-white">{tx.user_notes}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Matched Document */}
                        {hasMatchedDoc && tx.matched_document && (
                          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                              <DocumentTextIcon className="h-4 w-4" />
                              Supporting Document
                            </h5>
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                              <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">Document Type:</span>
                                  <span className="ml-2 text-gray-900 dark:text-white">{getDocumentTypeLabel(tx.matched_document.file_type)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">Filename:</span>
                                  <span className="ml-2 text-gray-900 dark:text-white">{tx.matched_document.original_filename}</span>
                                </div>
                                {tx.matched_document.vendor_name && (
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Vendor:</span>
                                    <span className="ml-2 text-gray-900 dark:text-white">{tx.matched_document.vendor_name}</span>
                                  </div>
                                )}
                                {tx.matched_document.document_date && (
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Document Date:</span>
                                    <span className="ml-2 text-gray-900 dark:text-white">{formatDate(tx.matched_document.document_date)}</span>
                                  </div>
                                )}
                                {tx.matched_document.total_amount && (
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                                    <span className="ml-2 text-gray-900 dark:text-white font-semibold">{formatCurrency(tx.matched_document.total_amount)}</span>
                                  </div>
                                )}
                                {tx.matched_document.category && (
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Category:</span>
                                    <span className="ml-2 text-gray-900 dark:text-white">{tx.matched_document.category}</span>
                                  </div>
                                )}
                                {tx.matched_document.tags && tx.matched_document.tags.length > 0 && (
                                  <div className="col-span-2">
                                    <span className="text-gray-500 dark:text-gray-400">Tags:</span>
                                    <span className="ml-2 text-gray-900 dark:text-white">
                                      {tx.matched_document.tags.map((tag, i) => (
                                        <span key={i} className="inline-block bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs mr-1">
                                          {tag}
                                        </span>
                                      ))}
                                    </span>
                                  </div>
                                )}
                                {tx.matched_document.description && (
                                  <div className="col-span-2">
                                    <span className="text-gray-500 dark:text-gray-400">Description:</span>
                                    <span className="ml-2 text-gray-900 dark:text-white">{tx.matched_document.description}</span>
                                  </div>
                                )}
                                {tx.matched_document.notes && (
                                  <div className="col-span-2">
                                    <span className="text-gray-500 dark:text-gray-400">Notes:</span>
                                    <span className="ml-2 text-gray-900 dark:text-white">{tx.matched_document.notes}</span>
                                  </div>
                                )}
                              </div>
                              {(tx.matched_document.supabase_path || tx.matched_document.storage_tier) && (
                                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                  <button
                                    onClick={(e) => handleViewDocument(tx.matched_document!.id, e)}
                                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                  >
                                    <LinkIcon className="h-4 w-4" />
                                    View Document
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Potential Matches for Unreconciled */}
                        {!isMatched && tx.potential_matches && tx.potential_matches.length > 0 && (
                          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Potential Matches ({tx.potential_matches.length})
                            </h5>
                            <div className="space-y-2">
                              {tx.potential_matches.map((doc) => (
                                <div
                                  key={doc.id}
                                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                                  onClick={(e) => e.stopPropagation()}
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
                                      {(doc.invoice_date || doc.document_date) && (
                                        <span>{formatDate(doc.invoice_date || doc.document_date || '')}</span>
                                      )}
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
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleMatch(tx.id, doc.id)
                                    }}
                                    disabled={matchingTransaction === tx.id}
                                  >
                                    <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                                    Match
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {!isMatched && (!tx.potential_matches || tx.potential_matches.length === 0) && (
                          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <Text className="text-sm text-gray-500 dark:text-gray-400">
                              No matching documents found. Upload a receipt or invoice to match this transaction.
                            </Text>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      <ReceiptUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={handleUploadComplete}
      />

      <EmailForwardingInfo
        isOpen={showEmailInfo}
        onClose={() => setShowEmailInfo(false)}
      />

      <MatchBreakdownModal
        isOpen={breakdownModal.show}
        transaction={breakdownModal.transaction}
        document={breakdownModal.document}
        onConfirm={handleConfirmBreakdown}
        onCancel={() => setBreakdownModal({ show: false, transaction: null, document: null })}
      />
    </div>
  )
}
