'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Heading, Text, Button } from '@/components/catalyst'
import Link from 'next/link'
import { ChevronLeftIcon, DocumentIcon, ArrowUpTrayIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { useDropzone } from 'react-dropzone'

interface BankAccount {
  id: string
  account_name: string
  bank_name: string
  account_type: string
  default_spreadsheet_id: string | null
}

export default function ReceiptsUploadPage() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
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
      const {
        data: { user },
      } = await supabase.auth.getUser()

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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Validate file types
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    
    const invalidFiles = acceptedFiles.filter(
      file => !validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|pdf)$/i)
    )

    if (invalidFiles.length > 0) {
      setError('Invalid file types. Please upload JPG, PNG, or PDF files only.')
      return
    }

    // Validate file sizes (max 10MB each)
    const maxSize = 10 * 1024 * 1024 // 10MB
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
      setError('Please complete your profile (individual/company name) before uploading.')
      return
    }

    if (!selectedBankAccountId) {
      setError('Please select a bank account before uploading.')
      return
    }

    const selectedAccount = bankAccounts.find(acc => acc.id === selectedBankAccountId)
    if (selectedAccount && !selectedAccount.default_spreadsheet_id) {
      setError('Please set a default spreadsheet for this bank account before uploading.')
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
      formData.append('bank_account_id', selectedBankAccountId)

      const response = await fetch('/api/categorization/upload-invoices', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        const error = new Error(errorData.error || errorData.message || 'Upload failed')
        ;(error as any).data = errorData
        throw error
      }

      const data = await response.json()
      
      setUploading(false)
      setProgress(100)
      setJobId(data.jobId)

      // Redirect to uploads page to see processing status
      if (data.jobId) {
        setTimeout(() => {
          window.location.href = '/dashboard/uploads'
        }, 1500)
      }
    } catch (error: any) {
      // Try to extract error message from response
      let errorMessage = error.message || 'An error occurred during upload'
      if (error.data) {
        if (error.data.status_message) {
          errorMessage = error.data.status_message
        } else if (error.data.error) {
          errorMessage = error.data.error
        }
      }
      
      setUploading(false)
      setError(errorMessage)
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
      {/* Back link */}
      <Link
        href="/dashboard/uploads"
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Back to Uploads
      </Link>

      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <Heading>Upload Receipts</Heading>
          <Text>
            Upload receipt images or PDFs to match with your bank transactions
          </Text>
        </div>

        {/* Profile validation warning */}
        {!profileLoading && !profileReady && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Please complete your profile (individual/company name) before uploading.
              <Link href="/dashboard/setup" className="underline ml-1">Go to setup</Link>
            </p>
          </div>
        )}

        {/* Bank Account Selection */}
        {!uploading && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Bank Account <span className="text-red-500">*</span>
            </label>
            {loadingBankAccounts ? (
              <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-10 rounded-lg"></div>
            ) : bankAccounts.length === 0 ? (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  No bank accounts found. Please <Link href="/dashboard/setup" className="underline">create a bank account</Link> first.
                </p>
              </div>
            ) : (
              <select
                value={selectedBankAccountId}
                onChange={(e) => setSelectedBankAccountId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Select Bank Account --</option>
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
            border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
            transition-all duration-200
            ${
              isDragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center">
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Uploading... {progress}%
                </p>
              </>
            ) : files.length > 0 ? (
              <>
                <CheckCircleIcon className="h-12 w-12 text-green-500 mb-4" />
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {files.length} file{files.length > 1 ? 's' : ''} selected
                </p>
                <div className="space-y-1 mb-4 max-h-40 overflow-y-auto">
                  {files.map((file, index) => (
                    <p key={index} className="text-sm text-gray-500 dark:text-gray-400">
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  ))}
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleUpload()
                  }}
                  className="mt-4"
                >
                  Upload & Process
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    setFiles([])
                    setError(null)
                  }}
                  outline
                  className="mt-2"
                >
                  Clear Files
                </Button>
              </>
            ) : (
              <>
                <ArrowUpTrayIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {isDragActive
                    ? 'Drop your files here'
                    : 'Drag & drop your receipts'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  or click to browse
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
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
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Upload Error
              </p>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {jobId && !uploading && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Upload successful! Redirecting to view processing status...
            </p>
          </div>
        )}

        {/* Instructions */}
        {files.length === 0 && !uploading && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-3">
              How it works
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-2 list-disc list-inside">
              <li>Upload receipt images or PDFs</li>
              <li>We'll extract transaction details using OCR</li>
              <li>Match receipts with your bank transactions</li>
              <li>Keep organized records for tax purposes</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

