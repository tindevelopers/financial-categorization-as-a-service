'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/database/client'
import SpreadsheetUpload from '@/components/categorization/SpreadsheetUpload'
import { Heading, Text, Button } from '@/components/catalyst'
import Link from 'next/link'
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
  BuildingOffice2Icon
} from '@heroicons/react/24/outline'

interface BankAccount {
  id: string
  account_name: string
  bank_name: string
  account_type: string
}

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

type StatementTab = 'all' | 'bank' | 'credit-card' | 'processor'

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
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [resettingStorage, setResettingStorage] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [activeTab, setActiveTab] = useState<StatementTab>('all')
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

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
  }, [router])

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

  useEffect(() => {
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

  // Filter statements based on active tab
  const filteredStatements = statements.filter((statement) => {
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
    { id: 'all', label: 'All Statements', count: statements.length },
    { id: 'bank', label: 'Bank Statements', count: statements.filter(s => getStatementType(s.original_filename, s.bank_account) === 'bank').length },
    { id: 'credit-card', label: 'Credit Card Statements', count: statements.filter(s => getStatementType(s.original_filename, s.bank_account) === 'credit-card').length },
    { id: 'processor', label: 'Processors', count: statements.filter(s => getStatementType(s.original_filename, s.bank_account) === 'processor').length },
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

      {/* Statements List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {loading ? (
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
    </div>
  )
}
