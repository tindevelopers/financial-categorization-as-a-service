'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
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
  ArrowUpTrayIcon,
  DocumentIcon,
  XCircleIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/24/outline'
import { useDropzone } from 'react-dropzone'

interface BankAccount {
  id: string
  account_name: string
  bank_name: string
  account_type: string
  default_spreadsheet_id: string | null
}

interface Invoice {
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
  document_id?: string  // First document ID for this job
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
      return { text: 'Ready for Reconciliation', color: 'text-green-600 dark:text-green-400' }
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

export default function InvoicesReceiptsPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Upload state
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('')
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(true)
  const [profileReady, setProfileReady] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/signin')
      }
    }

    checkAuth()
    fetchBankAccounts()
    fetchProfileStatus()
  }, [router])

  const fetchBankAccounts = async () => {
    try {
      const response = await fetch('/api/bank-accounts')
      const data = await response.json()
      if (data.success && data.bank_accounts) {
        setBankAccounts(data.bank_accounts)
        if (data.bank_accounts.length === 1) {
          setSelectedBankAccountId(data.bank_accounts[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error)
    } finally {
      setLoadingBankAccounts(false)
    }
  }

  const fetchProfileStatus = async () => {
    try {
      const response = await fetch('/api/company')
      if (response.ok) {
        const data = await response.json()
        const companies = data.companies || []
        const hasName = companies.some((c: any) => c.company_name)
        setProfileReady(hasName)
      } else {
        setProfileReady(false)
      }
    } catch {
      setProfileReady(false)
    } finally {
      setProfileLoading(false)
    }
  }

  const fetchInvoices = async () => {
    try {
      const response = await fetch('/api/categorization/jobs?limit=50')
      
      if (!response.ok) {
        throw new Error('Failed to fetch invoices')
      }

      const result = await response.json()
      
      // Filter for invoices/receipts only (file_type is 'invoice' or 'receipt' or job_type is 'invoice')
      const invoiceJobs = (result.jobs || []).filter((job: Invoice) => 
        job.file_type === 'invoice' || 
        job.file_type === 'receipt' ||
        job.job_type === 'invoice'
      )
      
      // Fetch document IDs for each job
      const jobsWithDocs = await Promise.all(
        invoiceJobs.map(async (job: Invoice) => {
          try {
            const docsResponse = await fetch(`/api/categorization/jobs/${job.id}/documents`)
            if (docsResponse.ok) {
              const docsData = await docsResponse.json()
              const firstDoc = docsData.documents?.[0]
              return { ...job, document_id: firstDoc?.id }
            }
          } catch (err) {
            console.error(`Error fetching docs for job ${job.id}:`, err)
          }
          return job
        })
      )
      
      setInvoices(jobsWithDocs)
    } catch (error: any) {
      console.error('Error fetching invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
    
    // Poll for updates every 3 seconds if there are processing jobs
    pollingIntervalRef.current = setInterval(() => {
      const hasProcessingJobs = invoices.some(inv => 
        ['processing', 'queued', 'received'].includes(inv.status)
      )
      if (hasProcessingJobs) {
        fetchInvoices()
      }
    }, 3000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  const handleDelete = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this invoice/receipt? This action cannot be undone.')) {
      return
    }
    
    setDeletingId(jobId)
    try {
      const response = await fetch(`/api/categorization/jobs/${jobId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete')
      }
      
      setInvoices(prev => prev.filter(inv => inv.id !== jobId))
    } catch (error: any) {
      console.error('Error deleting:', error)
      alert('Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  const pollJobStatus = async (jobId: string) => {
    const maxAttempts = 300 // 5 minutes (increased from 2 minutes)
    let attempts = 0

    const poll = async () => {
      try {
        const response = await fetch(`/api/categorization/jobs/${jobId}`)
        if (!response.ok) throw new Error('Failed to fetch job status')

        const data = await response.json()
        const job = data.job

        if (job) {
          setJobStatus(job.status)
          setStatusMessage(job.status_message || job.error_message)

          let newProgress = 0
          if (job.status === 'received') newProgress = 10
          else if (job.status === 'queued') newProgress = 20
          else if (job.status === 'processing') {
            const total = job.total_items || 1
            const processed = job.processed_items || 0
            const failed = job.failed_items || 0
            newProgress = Math.min(90, 20 + Math.floor(((processed + failed) / total) * 70))
          } else if (job.status === 'reviewing' || job.status === 'completed') {
            newProgress = 100
            setUploading(false)
            setFiles([])
            setShowUpload(false)
            fetchInvoices()
            return
          } else if (job.status === 'failed') {
            newProgress = 100
            setUploading(false)
            setError(job.status_message || job.error_message || 'Processing failed')
            return
          }

          setProgress(newProgress)

          if (!['reviewing', 'completed', 'failed'].includes(job.status)) {
            attempts++
            if (attempts < maxAttempts) {
              // Show a warning after 2 minutes, but keep polling
              if (attempts === 120) {
                setStatusMessage('Processing is taking longer than usual, but still running...')
              }
              setTimeout(poll, 1000)
            } else {
              setUploading(false)
              setError('Processing is taking longer than expected. Please check back later or refresh the page.')
            }
          }
        }
      } catch (error: any) {
        console.error('Error polling job status:', error)
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000)
        } else {
          setUploading(false)
          setError('Failed to track processing status.')
        }
      }
    }

    poll()
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    
    const invalidFiles = acceptedFiles.filter(
      file => !validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|pdf)$/i)
    )

    if (invalidFiles.length > 0) {
      setError('Invalid file types. Please upload JPG, PNG, or PDF files only.')
      return
    }

    const maxSize = 10 * 1024 * 1024
    const oversizedFiles = acceptedFiles.filter(file => file.size > maxSize)

    if (oversizedFiles.length > 0) {
      setError(`Some files exceed 10MB limit: ${oversizedFiles.map(f => f.name).join(', ')}`)
      return
    }

    setFiles((prev) => [...prev, ...acceptedFiles])
    setError(null)
  }, [])

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select at least one file')
      return
    }

    if (!profileReady && !profileLoading) {
      setError('Please complete your profile before uploading.')
      return
    }

    const selectedAccount = bankAccounts.find(acc => acc.id === selectedBankAccountId)
    if (selectedAccount && !selectedAccount.default_spreadsheet_id) {
      setError('Please set a default spreadsheet for this bank account.')
      return
    }

    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      const formData = new FormData()
      files.forEach((file, index) => {
        formData.append(`file_${index}`, file)
      })
      formData.append('fileCount', files.length.toString())
      if (selectedBankAccountId) {
        formData.append('bank_account_id', selectedBankAccountId)
      }

      const response = await fetch('/api/categorization/upload-invoices', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      
      setJobId(data.jobId)
      setJobStatus(data.status || 'received')
      setStatusMessage(data.status_message || data.message)
      
      if (data.jobId) {
        pollJobStatus(data.jobId)
      } else {
        setUploading(false)
        setProgress(100)
      }
    } catch (error: any) {
      setUploading(false)
      setError(error.message || 'An error occurred during upload')
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf'],
    },
    multiple: true,
    disabled: uploading,
  })

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
            Back to All Uploads
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => fetchInvoices()}
            color="white"
            className="flex items-center gap-2"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => setShowUpload(!showUpload)}
            color="blue"
            className="flex items-center gap-2"
          >
            {showUpload ? 'Hide Upload' : 'Upload Invoice/Receipt'}
          </Button>
        </div>
      </div>

      {/* Page Title */}
      <div>
        <Heading level={1}>Invoices &amp; Receipts</Heading>
        <Text className="mt-1 text-gray-600 dark:text-gray-400">
          Manage invoices and receipts for matching with bank transactions
        </Text>
      </div>

      {/* Upload Section (Collapsible) */}
      {showUpload && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          {/* Profile validation warning */}
          {!profileLoading && !profileReady && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Please complete your profile before uploading.
                <Link href="/dashboard/setup" className="underline ml-1">Go to setup</Link>
              </p>
            </div>
          )}

          {/* Bank Account Selection */}
          {!uploading && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Account <span className="text-gray-400 text-xs font-normal">(optional)</span>
              </label>
              {loadingBankAccounts ? (
                <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-10 rounded-lg"></div>
              ) : (
                <select
                  value={selectedBankAccountId}
                  onChange={(e) => setSelectedBankAccountId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Auto-match to any account --</option>
                  {bankAccounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.account_name} ({account.bank_name})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Upload Area */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
              transition-all duration-200
              ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'}
              ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />

            <div className="flex flex-col items-center">
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {statusMessage || `Uploading... ${progress}%`}
                  </p>
                  <div className="w-full max-w-xs mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </>
              ) : files.length > 0 ? (
                <>
                  <CheckCircleIcon className="h-10 w-10 text-green-500 mb-4" />
                  <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {files.length} file{files.length > 1 ? 's' : ''} selected
                  </p>
                  <div className="space-y-1 mb-4 max-h-32 overflow-y-auto">
                    {files.map((file, index) => (
                      <p key={index} className="text-sm text-gray-500 dark:text-gray-400">
                        {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={(e) => { e.stopPropagation(); handleUpload() }}
                    >
                      Upload & Process
                    </Button>
                    <Button
                      onClick={(e) => { e.stopPropagation(); setFiles([]); setError(null) }}
                      outline
                    >
                      Clear
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <ArrowUpTrayIcon className="h-10 w-10 text-gray-400 mb-4" />
                  <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {isDragActive ? 'Drop files here' : 'Drag & drop invoices/receipts'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">or click to browse</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <DocumentIcon className="h-4 w-4" />
                    <span>Supports .jpg, .png, .pdf (max 10MB each)</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
              <XCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Invoices List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <Text className="mt-4 text-gray-500">Loading invoices...</Text>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center">
            <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <Heading level={3} className="text-gray-600 dark:text-gray-400">No invoices or receipts yet</Heading>
            <Text className="mt-2 text-gray-500 dark:text-gray-500">
              Upload your first invoice or receipt to get started
            </Text>
            <Button
              onClick={() => setShowUpload(true)}
              color="blue"
              className="mt-4"
            >
              Upload Invoice/Receipt
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Filename
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Items
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
                {invoices.map((invoice) => {
                  const statusInfo = getStatusLabel(invoice.status, invoice.status_message)
                  
                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs" title={invoice.original_filename}>
                          {invoice.original_filename}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                          {invoice.file_type === 'receipt' ? 'Receipt' : 'Invoice'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(invoice.status)}
                          <span className={`text-sm ${statusInfo.color}`}>
                            {statusInfo.text}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {invoice.processed_items !== undefined ? (
                          <span>
                            {invoice.processed_items}
                            {invoice.failed_items ? ` (${invoice.failed_items} failed)` : ''}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(invoice.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {invoice.status === 'completed' && invoice.document_id && (
                            <>
                              <Link
                                href={`/dashboard/invoices/${invoice.document_id}`}
                                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-md"
                              >
                                Review
                              </Link>
                              <Link
                                href="/dashboard/statements"
                                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-900/20 dark:hover:bg-green-900/40 rounded-md"
                              >
                                <ArrowsRightLeftIcon className="h-4 w-4 mr-1" />
                                Reconcile
                              </Link>
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(invoice.id)}
                            disabled={deletingId === invoice.id}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-md disabled:opacity-50"
                          >
                            {deletingId === invoice.id ? (
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
        )}
      </div>
    </div>
  )
}
