'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/database/client'
import SpreadsheetUpload from '@/components/categorization/SpreadsheetUpload'
import { Heading, Text, Button } from '@/components/catalyst'
import Link from 'next/link'

// Category options for transaction categorization
const CATEGORY_OPTIONS = [
  "Income",
  "Sales",
  "Refund",
  "Transfer In",
  "Cost of Goods Sold",
  "Operating Expenses",
  "Payroll",
  "Rent",
  "Utilities",
  "Insurance",
  "Professional Services",
  "Office Supplies",
  "Travel",
  "Meals & Entertainment",
  "Marketing",
  "Software & Subscriptions",
  "Bank Fees",
  "Interest Expense",
  "Taxes",
  "Equipment",
  "Transfer Out",
  "Owner Draw",
  "Loan Payment",
  "Other Expense",
  "Uncategorized",
]
import { 
  ChevronLeftIcon,
  ArrowPathIcon,
  TrashIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  BanknotesIcon,
  CreditCardIcon,
  BuildingOffice2Icon,
  EllipsisVerticalIcon,
  PencilIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

interface BankAccount {
  id: string
  account_name: string
  bank_name: string
  account_type: string
}

type AccountKey = `bank:${string}` | `processor:${string}`

interface Statement {
  id: string
  original_filename: string
  status: string
  status_message?: string
  created_at: string
  job_type: string
  file_type?: string | null
  total_items?: number
  processed_items?: number
  failed_items?: number
  error_code?: string
  error_message?: string
  bank_account_id?: string | null
  bank_account?: BankAccount | null
}

type StatementTab = 'all' | 'bank' | 'credit-card' | 'processor' | 'transactions'

const KNOWN_PROCESSORS: Array<{ slug: string; label: string; keywords: string[] }> = [
  { slug: 'stripe', label: 'Stripe', keywords: ['stripe'] },
  { slug: 'paypal', label: 'PayPal', keywords: ['paypal'] },
  { slug: 'booking', label: 'Booking.com', keywords: ['booking'] },
  { slug: 'expedia', label: 'Expedia', keywords: ['expedia'] },
  { slug: 'airbnb', label: 'Airbnb', keywords: ['airbnb'] },
  { slug: 'vrbo', label: 'VRBO', keywords: ['vrbo'] },
  { slug: 'lodgify', label: 'Lodgify', keywords: ['lodgify'] },
]

function inferProcessorSlug(filename: string): string | null {
  const lower = filename.toLowerCase()
  for (const p of KNOWN_PROCESSORS) {
    if (p.keywords.some((k) => lower.includes(k))) return p.slug
  }
  return null
}

function getAccountKey(statement: Statement): AccountKey | null {
  if (statement.bank_account_id) return `bank:${statement.bank_account_id}`
  const slug = inferProcessorSlug(statement.original_filename)
  if (slug) return `processor:${slug}`
  return null
}

function getAccountLabelFromKey(
  key: AccountKey,
  bankAccountsById: Map<string, BankAccount>
): string {
  if (key.startsWith('bank:')) {
    const id = key.slice('bank:'.length)
    const acct = bankAccountsById.get(id)
    if (!acct) return 'Unknown Account'
    return `${acct.account_name} (${acct.bank_name})`
  }
  const slug = key.slice('processor:'.length)
  const known = KNOWN_PROCESSORS.find((p) => p.slug === slug)
  return known?.label || slug
}

// Helper to categorize statement type
function getStatementType(filename: string, bankAccount?: BankAccount | null): 'bank' | 'credit-card' | 'processor' {
  const lowerFilename = filename.toLowerCase()
  const bankName = bankAccount?.bank_name?.toLowerCase() || ''
  const accountType = bankAccount?.account_type?.toLowerCase() || ''
  
  // Credit card statements
  if (accountType.includes('credit') || lowerFilename.includes('credit card')) {
    return 'credit-card'
  }
  
  // Processors (Stripe, PayPal, Booking.com, Expedia, Airbnb, etc.)
  if (
    lowerFilename.includes('stripe') ||
    lowerFilename.includes('paypal') ||
    lowerFilename.includes('booking') ||
    lowerFilename.includes('expedia') ||
    lowerFilename.includes('airbnb') ||
    lowerFilename.includes('vrbo') ||
    lowerFilename.includes('lodgify')
  ) {
    return 'processor'
  }
  
  // Default: Bank statement
  return 'bank'
}

// Helper to get statement source display info
function getStatementSource(filename: string, bankAccount?: BankAccount | null): {
  icon: React.ReactNode
  label: string
  color: string
} {
  const type = getStatementType(filename, bankAccount)
  
  switch (type) {
    case 'credit-card':
      return {
        icon: <CreditCardIcon className="h-5 w-5" />,
        label: 'Credit Card',
        color: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20'
      }
    case 'processor':
      return {
        icon: <BuildingOffice2Icon className="h-5 w-5" />,
        label: 'Processor',
        color: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20'
      }
    default:
      return {
        icon: <BanknotesIcon className="h-5 w-5" />,
        label: 'Bank',
        color: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20'
      }
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
    case 'reviewing':
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />
    case 'processing':
    case 'queued':
    case 'received':
      return <ClockIcon className="h-5 w-5 text-yellow-500 animate-pulse" />
    case 'failed':
      return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
    default:
      return <DocumentTextIcon className="h-5 w-5 text-gray-400" />
  }
}

function getStatusLabel(status: string, statusMessage?: string) {
  switch (status) {
    case 'completed':
      return { text: 'Completed', color: 'text-green-600 dark:text-green-400' }
    case 'reviewing':
      return { text: 'Ready for Review', color: 'text-green-600 dark:text-green-400' }
    case 'processing':
      return { text: statusMessage || 'Processing...', color: 'text-yellow-600 dark:text-yellow-400' }
    case 'queued':
      return { text: 'Queued', color: 'text-yellow-600 dark:text-yellow-400' }
    case 'received':
      return { text: 'Received', color: 'text-blue-600 dark:text-blue-400' }
    case 'failed':
      return { text: 'Failed', color: 'text-red-600 dark:text-red-400' }
    default:
      return { text: status, color: 'text-gray-600 dark:text-gray-400' }
  }
}

export default function StatementsPage() {
  const router = useRouter()
  const [statements, setStatements] = useState<Statement[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [resettingStorage, setResettingStorage] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [activeTab, setActiveTab] = useState<StatementTab>('all')
  const [selectedAccountKey, setSelectedAccountKey] = useState<AccountKey | 'all'>('all')
  const [transactions, setTransactions] = useState<any[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [availableDocuments, setAvailableDocuments] = useState<any[]>([])
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('')
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Function to save transaction changes
  const handleSaveTransaction = async () => {
    if (!editingTransaction?.id) return

    try {
      setIsSaving(true)
      
      // Prepare the update payload
      const updatePayload: any = {}
      
      if (editingTransaction.category !== undefined) {
        updatePayload.category = editingTransaction.category
      }
      if (editingTransaction.subcategory !== undefined) {
        updatePayload.subcategory = editingTransaction.subcategory
      }
      if (editingTransaction.notes !== undefined) {
        updatePayload.user_notes = editingTransaction.notes
      }
      
      // Call the API to update the transaction
      const response = await fetch(`/api/categorization/transactions/${editingTransaction.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save transaction')
      }

      // Update the local state to reflect the changes
      setTransactions(prevTransactions =>
        prevTransactions.map(tx =>
          tx.id === editingTransaction.id
            ? { ...tx, ...updatePayload }
            : tx
        )
      )

      // Close the modal
      setShowEditModal(false)
      setEditingTransaction(null)

      // Optionally show a success message
      console.log('Transaction saved successfully')
    } catch (error: any) {
      console.error('Error saving transaction:', error)
      alert(`Failed to save transaction: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const loadAvailableDocuments = async () => {
    try {
      setLoadingDocuments(true)
      const response = await fetch('/api/reconciliation/documents')
      if (!response.ok) {
        const errorData = await response.json()
        console.error('Failed to load documents:', errorData)
        throw new Error('Failed to load documents')
      }
      
      const data = await response.json()
      console.log('[Statements] Loaded documents:', data.count, 'documents')
      console.log('[Statements] Documents:', data.documents)
      setAvailableDocuments(data.documents || [])
    } catch (error) {
      console.error('Error loading documents:', error)
      setAvailableDocuments([])
    } finally {
      setLoadingDocuments(false)
    }
  }

  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          router.push('/signin')
        }
      } catch (error: any) {
        console.error('Auth check error:', error)
      }
    }

    checkAuth()
    loadAvailableDocuments()
  }, [router])

  const fetchBankAccounts = async () => {
    try {
      setLoadingAccounts(true)
      const resp = await fetch('/api/bank-accounts?include_inactive=true')
      if (!resp.ok) throw new Error('Failed to fetch bank accounts')
      const data = await resp.json()
      setBankAccounts(data.bank_accounts || [])
    } catch (e) {
      console.error('Error fetching bank accounts:', e)
      setBankAccounts([])
    } finally {
      setLoadingAccounts(false)
    }
  }

  const fetchStatements = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'fetch-debug',hypothesisId:'H2',location:'apps/portal/app/dashboard/statements/page.tsx:fetchStatements',message:'fetch start',data:{url:'/api/categorization/jobs?limit=100',method:'GET',windowLocation:typeof window!=='undefined'?window.location.href:'SSR'},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    try {
      const startTime = Date.now();
      // Fetch all jobs that are statements (bank statements, credit cards, processors)
      const response = await fetch('/api/categorization/jobs?limit=100')
      const elapsedMs = Date.now() - startTime;
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'fetch-debug',hypothesisId:'H2',location:'apps/portal/app/dashboard/statements/page.tsx:fetchStatements',message:'fetch response received',data:{status:response.status,statusText:response.statusText,ok:response.ok,elapsedMs},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      
      if (!response.ok) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'fetch-debug',hypothesisId:'H2',location:'apps/portal/app/dashboard/statements/page.tsx:fetchStatements',message:'response not ok',data:{status:response.status,statusText:response.statusText},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        throw new Error('Failed to fetch statements')
      }

      const result = await response.json()
      
      // Filter for statements only (file_type === 'bank_statement' OR job_type === 'spreadsheet')
      const allStatements = (result.jobs || []).filter((job: Statement) => 
        job.file_type === 'bank_statement' || 
        (job.job_type === 'spreadsheet' && !job.file_type)
      )
      
      setStatements(allStatements)
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'fetch-debug',hypothesisId:'H2',location:'apps/portal/app/dashboard/statements/page.tsx:fetchStatements',message:'fetch error caught',data:{error:error?.message||String(error),errorType:error?.constructor?.name,errorName:error?.name,isNetworkError:error?.message?.includes('Failed to fetch')||error?.message?.includes('NetworkError'),stack:error?.stack?.substring(0,200)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      console.error('Error fetching statements:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTransactions = async (bankAccountId: string) => {
    try {
      setLoadingTransactions(true)
      const response = await fetch(`/api/bank-accounts/${bankAccountId}/transactions`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch transactions')
      }

      const result = await response.json()
      setTransactions(result.transactions || [])
    } catch (error: any) {
      console.error('Error fetching transactions:', error)
      setTransactions([])
    } finally {
      setLoadingTransactions(false)
    }
  }

  useEffect(() => {
    fetchBankAccounts()
    fetchStatements()
    
    // Poll for updates every 3 seconds
    pollingIntervalRef.current = setInterval(() => {
      fetchStatements()
    }, 3000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [])

  // Fetch transactions when switching to transactions tab and account is selected
  useEffect(() => {
    if (activeTab === 'transactions' && selectedAccountKey !== 'all' && selectedAccountKey.startsWith('bank:')) {
      const bankAccountId = selectedAccountKey.slice('bank:'.length)
      fetchTransactions(bankAccountId)
    } else if (activeTab !== 'transactions') {
      // Clear transactions when not on transactions tab
      setTransactions([])
    }
  }, [activeTab, selectedAccountKey])

  const bankAccountsById = useMemo(() => {
    return new Map(bankAccounts.map((a) => [a.id, a]))
  }, [bankAccounts])

  const allAccountKeys: AccountKey[] = useMemo(() => {
    const keys = new Set<AccountKey>()
    // Prefer explicit accounts (bank/credit card) from bank_accounts table
    for (const a of bankAccounts) keys.add(`bank:${a.id}`)
    // Add inferred processors from current statements
    for (const s of statements) {
      const k = getAccountKey(s)
      if (k && k.startsWith('processor:')) keys.add(k)
    }
    return Array.from(keys)
  }, [bankAccounts, statements])

  const filteredByAccount = useMemo(() => {
    if (selectedAccountKey === 'all') return statements
    if (selectedAccountKey.startsWith('bank:')) {
      const id = selectedAccountKey.slice('bank:'.length)
      return statements.filter((s) => s.bank_account_id === id)
    }
    const slug = selectedAccountKey.slice('processor:'.length)
    return statements.filter((s) => !s.bank_account_id && inferProcessorSlug(s.original_filename) === slug)
  }, [selectedAccountKey, statements])

  // Filter statements based on active tab + selected account key
  const filteredStatements = useMemo(() => {
    return filteredByAccount.filter((statement) => {
      if (activeTab === 'all') return true
      const statementType = getStatementType(statement.original_filename, statement.bank_account)
      switch (activeTab) {
        case 'bank':
          return statementType === 'bank'
        case 'credit-card':
          return statementType === 'credit-card'
        case 'processor':
          return statementType === 'processor'
        default:
          return true
      }
    })
  }, [activeTab, filteredByAccount])

  const rollups = useMemo(() => {
    type Rollup = {
      key: AccountKey
      label: string
      statementCount: number
      totalTransactions: number
      lastUploadedAt: string | null
      statusCounts: Record<string, number>
      reconcileHref: string
    }

    const map = new Map<AccountKey, Omit<Rollup, 'label' | 'reconcileHref'>>()
    for (const s of statements) {
      const key = getAccountKey(s)
      if (!key) continue
      const existing = map.get(key) || {
        key,
        statementCount: 0,
        totalTransactions: 0,
        lastUploadedAt: null as string | null,
        statusCounts: {} as Record<string, number>,
      }
      existing.statementCount += 1
      existing.totalTransactions += typeof s.processed_items === 'number' ? s.processed_items : 0
      existing.statusCounts[s.status] = (existing.statusCounts[s.status] || 0) + 1
      if (!existing.lastUploadedAt || new Date(s.created_at).getTime() > new Date(existing.lastUploadedAt).getTime()) {
        existing.lastUploadedAt = s.created_at
      }
      map.set(key, existing)
    }

    const items: Rollup[] = Array.from(map.values()).map((r) => {
      const label = getAccountLabelFromKey(r.key, bankAccountsById)
      const reconcileHref =
        r.key.startsWith('bank:')
          ? `/dashboard/reconciliation?bank_account_id=${encodeURIComponent(r.key.slice('bank:'.length))}`
          : `/dashboard/reconciliation?processor=${encodeURIComponent(r.key.slice('processor:'.length))}`
      return { ...r, label, reconcileHref }
    })

    items.sort((a, b) => {
      const ta = a.lastUploadedAt ? new Date(a.lastUploadedAt).getTime() : 0
      const tb = b.lastUploadedAt ? new Date(b.lastUploadedAt).getTime() : 0
      return tb - ta
    })
    return items
  }, [bankAccountsById, statements])

  const handleDelete = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this statement? This action cannot be undone.')) {
      return
    }
    
    setDeletingId(jobId)
    try {
      const response = await fetch(`/api/categorization/jobs/${jobId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete statement')
      }
      
      setStatements(prev => prev.filter(s => s.id !== jobId))
    } catch (error: any) {
      console.error('Error deleting statement:', error)
      alert('Failed to delete statement')
    } finally {
      setDeletingId(null)
    }
  }

  const handleResetStorage = async () => {
    if (!confirm('Are you sure you want to delete EVERYTHING and start fresh? This will permanently delete ALL uploaded files (statements, receipts, invoices), transactions, and cannot be undone.')) {
      return
    }

    if (!confirm('Final warning: this is irreversible. Delete EVERYTHING now?')) {
      return
    }

    setResettingStorage(true)
    try {
      const response = await fetch('/api/categorization/jobs/reset-storage', {
        method: 'POST',
      })

      const result = await response.json().catch(() => ({} as any))
      if (!response.ok) {
        throw new Error(result.error || 'Failed to reset storage')
      }

      // Clear local state and refetch
      setStatements([])
      await fetchStatements()
      alert(`Deleted ${result.deletedCount || 0} upload(s). You're starting fresh.`)
    } catch (error: any) {
      console.error('Error resetting storage:', error)
      alert(`Failed to delete everything: ${error.message}`)
    } finally {
      setResettingStorage(false)
    }
  }

  const handleUploadComplete = () => {
    setShowUpload(false)
    fetchStatements()
  }

  const tabs: { id: StatementTab; label: string; count: number }[] = [
    { id: 'all', label: 'All Statements', count: filteredByAccount.length },
    { id: 'bank', label: 'Bank Statements', count: filteredByAccount.filter(s => getStatementType(s.original_filename, s.bank_account) === 'bank').length },
    { id: 'credit-card', label: 'Credit Card Statements', count: filteredByAccount.filter(s => getStatementType(s.original_filename, s.bank_account) === 'credit-card').length },
    { id: 'processor', label: 'Processors', count: filteredByAccount.filter(s => getStatementType(s.original_filename, s.bank_account) === 'processor').length },
    { id: 'transactions', label: 'All Transactions', count: transactions.length },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/uploads"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Back to Uploads
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => fetchStatements()}
            color="white"
            className="flex items-center gap-2"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={handleResetStorage}
            color="red"
            className="flex items-center gap-2"
            disabled={resettingStorage}
          >
            {resettingStorage ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <TrashIcon className="h-4 w-4" />
            )}
            Delete Everything
          </Button>
          <Button
            onClick={() => setShowUpload(!showUpload)}
            color="emerald"
            className="flex items-center gap-2"
          >
            {showUpload ? 'Hide Upload' : 'Upload Statement'}
          </Button>
        </div>
      </div>

      {/* Page Title */}
      <div>
        <Heading level={1}>Statements</Heading>
        <Text className="mt-1 text-gray-600 dark:text-gray-400">
          Manage bank statements, credit card statements, and processor statements (Stripe, PayPal, Booking.com, Expedia, etc.)
        </Text>
      </div>

      {/* Account Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1 max-w-xl">
          <Text className="text-sm text-gray-500 dark:text-gray-400">Filter by account</Text>
          <div className="mt-1">
            <select
              value={selectedAccountKey}
              onChange={(e) => {
                const v = e.target.value as AccountKey | 'all'
                setSelectedAccountKey(v)
              }}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              disabled={loadingAccounts}
            >
              <option value="all">All accounts</option>
              {allAccountKeys.map((k) => (
                <option key={k} value={k}>
                  {getAccountLabelFromKey(k, bankAccountsById)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {selectedAccountKey !== 'all' && (
          <div className="flex gap-2">
            <Button
              color="white"
              onClick={() => setSelectedAccountKey('all')}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Account rollups */}
      {rollups.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rollups.map((r) => {
            const isSelected = selectedAccountKey === r.key
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setSelectedAccountKey(r.key)}
                className={`text-left rounded-lg border p-4 transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={r.label}>
                      {r.label}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {r.statementCount} statement{r.statementCount === 1 ? '' : 's'} • {r.totalTransactions} transaction{r.totalTransactions === 1 ? '' : 's'}
                    </div>
                    {r.lastUploadedAt && (
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Last upload: {new Date(r.lastUploadedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                  <Link
                    href={r.reconcileHref}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 rounded-md"
                  >
                    Reconcile
                  </Link>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(r.statusCounts).map(([status, count]) => (
                    <span
                      key={`${r.key}-${status}`}
                      className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-200"
                    >
                      {status}: {count}
                    </span>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors
                ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`
                    ml-2 rounded-full py-0.5 px-2 text-xs
                    ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }
                  `}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Upload Section (Collapsible) */}
      {showUpload && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <SpreadsheetUpload />
        </div>
      )}

      {/* Statements List or Transactions View */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {activeTab === 'transactions' ? (
          // Transactions View
          selectedAccountKey === 'all' || !selectedAccountKey.startsWith('bank:') ? (
            <div className="p-8 text-center">
              <BanknotesIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <Heading level={3} className="text-gray-600 dark:text-gray-400">
                Select a bank account
              </Heading>
              <Text className="mt-2 text-gray-500 dark:text-gray-500">
                Please select a bank account from the dropdown above to view all transactions
              </Text>
            </div>
          ) : loadingTransactions ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <Text className="mt-4 text-gray-500">Loading transactions...</Text>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center">
              <BanknotesIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <Heading level={3} className="text-gray-600 dark:text-gray-400">
                No transactions yet
              </Heading>
              <Text className="mt-2 text-gray-500 dark:text-gray-500">
                Upload statements for this account to see transactions here
              </Text>
              <Button
                onClick={() => setShowUpload(true)}
                color="emerald"
                className="mt-4"
              >
                Upload Statement
              </Button>
            </div>
          ) : (
            // Transactions table will be rendered here
            <div className="relative">
              <div className="absolute right-0 top-0 bottom-0 w-16 pointer-events-none bg-gradient-to-l from-white via-white/80 to-transparent dark:from-gray-800 dark:via-gray-800/80 z-10"></div>
              
              <div className="overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-gray-100 dark:[&::-webkit-scrollbar-track]:bg-gray-800 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-gray-500">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Subcategory
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Source
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {transactions.map((transaction) => {
                      const amount = transaction.amount || 0
                      // Use is_debit field to determine if it's a debit (outgoing/negative) or credit (incoming/positive)
                      // If is_debit is not set, fall back to checking if amount is negative
                      const isDebit = transaction.is_debit !== null && transaction.is_debit !== undefined 
                        ? transaction.is_debit 
                        : amount < 0
                      const formattedAmount = new Intl.NumberFormat('en-GB', {
                        style: 'currency',
                        currency: 'GBP',
                      }).format(Math.abs(amount))
                      
                      return (
                        <tr 
                          key={transaction.id} 
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {transaction.date ? new Date(transaction.date).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            }) : '—'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 dark:text-white max-w-md truncate" title={transaction.original_description}>
                              {transaction.original_description || '—'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className={`text-sm font-medium ${isDebit ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                              {isDebit ? '-' : '+'}{formattedAmount}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingTransaction(transaction)
                                setSelectedDocumentId('')
                                setShowEditModal(true)
                              }}
                              className="text-sm text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dashed underline-offset-4 text-left"
                            >
                              {transaction.category || 'Uncategorized'}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {transaction.subcategory || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {transaction.user_confirmed ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // TODO: Add unconfirm functionality
                                }}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/40 cursor-pointer"
                              >
                                <CheckCircleIcon className="h-3.5 w-3.5 mr-1" />
                                Confirmed
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // TODO: Add confirm functionality
                                }}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/40 cursor-pointer"
                              >
                                <ClockIcon className="h-3.5 w-3.5 mr-1" />
                                Pending
                              </button>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {transaction.job?.original_filename ? (
                              <div className="text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate" title={transaction.job.original_filename}>
                                {transaction.job.original_filename}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingTransaction(transaction)
                                  setSelectedDocumentId('')
                                  setShowEditModal(true)
                                }}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                title="Edit transaction"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (transaction.job_id) {
                                    router.push(`/dashboard/review/${transaction.job_id}`)
                                  }
                                }}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                title="View in statement"
                              >
                                <DocumentTextIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <Text className="mt-4 text-gray-500">Loading statements...</Text>
          </div>
        ) : filteredStatements.length === 0 ? (
          <div className="p-8 text-center">
            <BanknotesIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <Heading level={3} className="text-gray-600 dark:text-gray-400">
              {activeTab === 'all' 
                ? 'No statements yet'
                : `No ${tabs.find(t => t.id === activeTab)?.label.toLowerCase()} yet`}
            </Heading>
            <Text className="mt-2 text-gray-500 dark:text-gray-500">
              {activeTab === 'all'
                ? 'Upload your first statement to get started'
                : `Upload your first ${tabs.find(t => t.id === activeTab)?.label.toLowerCase()} to get started`}
            </Text>
            <Button
              onClick={() => setShowUpload(true)}
              color="emerald"
              className="mt-4"
            >
              Upload Statement
            </Button>
          </div>
        ) : (
          <div className="relative">
            {/* Scroll indicator - fade effect on right edge to indicate scrollable content */}
            <div className="absolute right-0 top-0 bottom-0 w-16 pointer-events-none bg-gradient-to-l from-white via-white/80 to-transparent dark:from-gray-800 dark:via-gray-800/80 z-10"></div>
            
            {/* Scrollable table container with visible scrollbar */}
            <div className="overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-gray-100 dark:[&::-webkit-scrollbar-track]:bg-gray-800 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-gray-500">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Filename
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Bank Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Transactions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Uploaded
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredStatements.map((statement) => {
                  const source = getStatementSource(statement.original_filename, statement.bank_account)
                  const statusInfo = getStatusLabel(statement.status, statement.status_message)
                  
                  return (
                    <tr key={statement.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium ${source.color}`}>
                          {source.icon}
                          {source.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs" title={statement.original_filename}>
                          {statement.original_filename}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {statement.bank_account ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {statement.bank_account.account_name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {statement.bank_account.bank_name}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(statement.status)}
                          <span className={`text-sm ${statusInfo.color}`}>
                            {statusInfo.text}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {statement.processed_items !== undefined ? (
                          <span>
                            {statement.processed_items}
                            {statement.failed_items ? ` (${statement.failed_items} failed)` : ''}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(statement.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {(statement.status === 'reviewing' || statement.status === 'completed') && (
                            <Link
                              href={`/dashboard/review/${statement.id}`}
                              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-md"
                            >
                              Review
                            </Link>
                          )}
                          <button
                            onClick={() => handleDelete(statement.id)}
                            disabled={deletingId === statement.id}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-md disabled:opacity-50"
                          >
                            {deletingId === statement.id ? (
                              <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                              <TrashIcon className="h-4 w-4" />
                            )}
                            <span className="ml-1">Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit Transaction Modal (WaveApps-style) */}
      {showEditModal && editingTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <Heading level={2}>Edit Transaction</Heading>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Date and Description */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={editingTransaction.date || ''}
                    onChange={(e) => setEditingTransaction({...editingTransaction, date: e.target.value})}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={editingTransaction.original_description || ''}
                    onChange={(e) => setEditingTransaction({...editingTransaction, original_description: e.target.value})}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* Amount and Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">GBP</span>
                    <input
                      type="number"
                      step="0.01"
                      value={editingTransaction.amount || 0}
                      onChange={(e) => setEditingTransaction({...editingTransaction, amount: parseFloat(e.target.value)})}
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type
                  </label>
                  <select
                    value={editingTransaction.is_debit ? 'withdrawal' : 'deposit'}
                    onChange={(e) => {
                      const isWithdrawal = e.target.value === 'withdrawal'
                      setEditingTransaction({
                        ...editingTransaction, 
                        is_debit: isWithdrawal
                      })
                    }}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  >
                    <option value="deposit">Deposit</option>
                    <option value="withdrawal">Withdrawal</option>
                  </select>
                </div>
              </div>

              {/* Category and Subcategory */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={editingTransaction.category || ''}
                    onChange={(e) => setEditingTransaction({...editingTransaction, category: e.target.value})}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Select category</option>
                    {CATEGORY_OPTIONS.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Subcategory
                  </label>
                  <input
                    type="text"
                    value={editingTransaction.subcategory || ''}
                    onChange={(e) => setEditingTransaction({...editingTransaction, subcategory: e.target.value})}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    placeholder="Enter subcategory"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={editingTransaction.notes || ''}
                  onChange={(e) => setEditingTransaction({...editingTransaction, notes: e.target.value})}
                  rows={3}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  placeholder="Write a note here..."
                />
              </div>

              {/* Match Invoice/Receipt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Match Invoice/Receipt
                </label>
                <select
                  value={selectedDocumentId}
                  onChange={(e) => setSelectedDocumentId(e.target.value)}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  disabled={loadingDocuments}
                >
                  <option value="">
                    {loadingDocuments ? 'Loading...' : availableDocuments.length === 0 ? 'No documents available' : '-- Select Invoice/Receipt --'}
                  </option>
                  {availableDocuments.map((doc: any) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.vendor_name || doc.original_filename} - £{doc.total_amount?.toFixed(2) || '0.00'} - {doc.document_date ? new Date(doc.document_date).toLocaleDateString('en-GB') : 'No date'}
                    </option>
                  ))}
                </select>
                {selectedDocumentId && (
                  <button
                    onClick={async () => {
                      if (!selectedDocumentId || !editingTransaction) return
                      
                      try {
                        setIsSaving(true)
                        const response = await fetch('/api/reconciliation/match', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            transaction_id: editingTransaction.id,
                            document_id: selectedDocumentId,
                          }),
                        })
                        
                        if (!response.ok) throw new Error('Match failed')
                        
                        alert('Invoice matched successfully!')
                        setSelectedDocumentId('')
                        setShowEditModal(false)
                        loadTransactions()
                        loadAvailableDocuments()
                      } catch (error) {
                        console.error('Match error:', error)
                        alert('Failed to match invoice')
                      } finally {
                        setIsSaving(false)
                      }
                    }}
                    disabled={isSaving}
                    className="mt-2 inline-flex items-center px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-900/20 dark:hover:bg-green-900/40 rounded-md disabled:opacity-50"
                  >
                    {isSaving ? 'Matching...' : 'Match Invoice'}
                  </button>
                )}
              </div>

              {/* Source Statement */}
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Source Statement:</strong> {editingTransaction.job?.original_filename || 'Unknown'}
                </div>
                {editingTransaction.job_id && (
                  <Link
                    href={`/dashboard/review/${editingTransaction.job_id}`}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
                  >
                    View full statement →
                  </Link>
                )}
              </div>

              {/* Mark as Reviewed Checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="user_confirmed"
                  checked={editingTransaction.user_confirmed || false}
                  onChange={(e) => setEditingTransaction({...editingTransaction, user_confirmed: e.target.checked})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="user_confirmed" className="text-sm text-gray-700 dark:text-gray-300">
                  Mark as reviewed
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={() => setShowEditModal(false)}
                color="white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTransaction}
                color="blue"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
