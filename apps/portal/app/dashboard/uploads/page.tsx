'use client'

import { useState, useEffect, useRef } from 'react'
import { Heading, Text, Button } from '@/components/catalyst'
import { 
  ArrowUpTrayIcon, 
  DocumentTextIcon, 
  ClockIcon, 
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  Squares2X2Icon,
  TableCellsIcon,
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  FunnelIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'

interface StorageInfo {
  tier: 'hot' | 'archive' | 'restoring'
  total_size_bytes: number
  document_count: number
  archived_at: string | null
}

interface Upload {
  id: string
  original_filename: string
  status: string
  status_message?: string
  created_at: string
  job_type: string
  file_type?: string | null // file_type from financial_documents
  total_items?: number
  processed_items?: number
  failed_items?: number
  error_code?: string
  error_message?: string
  storage_info?: StorageInfo
  last_synced_to_sheets_at?: string | null
  bank_account_id?: string | null
  spreadsheet_id?: string | null
  spreadsheet_tab_id?: string | null
  bank_account?: {
    id: string
    account_name: string
    bank_name: string
    account_type: string
  } | null
}

interface ConnectedSheet {
  id: string
  source_id: string
  source_name: string
  sheet_name?: string
  last_sync_at?: string
}

export default function UploadsPage() {
  const [uploads, setUploads] = useState<Upload[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [resettingStorage, setResettingStorage] = useState(false)
  const [connectedSheets, setConnectedSheets] = useState<ConnectedSheet[]>([])
  const [syncingJobId, setSyncingJobId] = useState<string | null>(null)
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null)
  const [cleanupDropdownOpen, setCleanupDropdownOpen] = useState(false)
  const [cleaningUp, setCleaningUp] = useState(false)
  const [cleanupPreview, setCleanupPreview] = useState<{ type: string; count: number; jobs: any[] } | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const cleanupDropdownRef = useRef<HTMLDivElement>(null)

  const fetchUploads = async () => {
    try {
      // Use the new API endpoint that includes storage info
      const response = await fetch('/api/categorization/jobs?limit=20')
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error('Failed to fetch uploads')
      }

      const result = await response.json()
      setUploads(result.jobs || [])
    } catch (error: any) {
      console.error('Error fetching uploads:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchConnectedSheets = async () => {
    try {
      const response = await fetch('/api/sync/google-sheets')
      if (response.ok) {
        const data = await response.json()
        setConnectedSheets(data.connections || [])
      }
    } catch (error) {
      console.error('Error fetching connected sheets:', error)
    }
  }

  useEffect(() => {
    fetchUploads()
    fetchConnectedSheets()

    // Set up polling for jobs that are still processing
    // Start polling immediately, will be adjusted based on active jobs
    pollingIntervalRef.current = setInterval(() => {
      fetchUploads()
    }, 3000) // Poll every 3 seconds

    // Also fetch again after a short delay to catch newly uploaded files
    // (in case of redirect from upload page)
    const timeoutId = setTimeout(() => {
      fetchUploads()
    }, 1000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      clearTimeout(timeoutId)
    }
  }, [])

  // Update polling based on current uploads state
  useEffect(() => {
    const hasActiveJobs = uploads.some(u => 
      ['received', 'queued', 'processing'].includes(u.status)
    )

    if (!hasActiveJobs && pollingIntervalRef.current) {
      // Stop polling when no active jobs
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    } else if (hasActiveJobs && !pollingIntervalRef.current) {
      // Resume polling if there are active jobs
      pollingIntervalRef.current = setInterval(() => {
        fetchUploads()
      }, 3000)
    }
  }, [uploads])

  // Check for new uploads when page becomes visible (e.g., after redirect from upload page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refresh immediately when page becomes visible
        fetchUploads()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Also check on focus (when user switches back to tab)
    const handleFocus = () => {
      fetchUploads()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  const getStatusDisplay = (upload: Upload) => {
    const status = upload.status
    const statusMessage = upload.status_message || status
    
    switch (status) {
      case 'received':
        return {
          color: 'text-green-600 dark:text-green-400',
          icon: CheckCircleIcon,
          label: 'File Received',
          message: statusMessage,
        }
      case 'queued':
        return {
          color: 'text-yellow-600 dark:text-yellow-400',
          icon: ClockIcon,
          label: 'Waiting to Process',
          message: statusMessage,
        }
      case 'processing':
        return {
          color: 'text-blue-600 dark:text-blue-400',
          icon: ArrowPathIcon,
          label: 'Processing',
          message: statusMessage,
          spinning: true,
        }
      case 'reviewing':
        return {
          color: 'text-purple-600 dark:text-purple-400',
          icon: CheckCircleIcon,
          label: 'Ready for Review',
          message: statusMessage,
        }
      case 'completed':
        return {
          color: 'text-green-600 dark:text-green-400',
          icon: CheckCircleIcon,
          label: 'Completed',
          message: statusMessage,
        }
      case 'failed':
        return {
          color: 'text-red-600 dark:text-red-400',
          icon: XCircleIcon,
          label: 'Failed',
          message: statusMessage,
        }
      default:
        return {
          color: 'text-gray-600 dark:text-gray-400',
          icon: DocumentTextIcon,
          label: status.charAt(0).toUpperCase() + status.slice(1),
          message: statusMessage,
        }
    }
  }

  const getStatusColor = (status: string) => {
    return getStatusDisplay({ status } as Upload).color
  }

  const getStorageTierBadge = (tier?: 'hot' | 'archive' | 'restoring') => {
    if (!tier) return null
    
    const badges = {
      hot: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Hot Storage' },
      archive: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Archived' },
      restoring: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Restoring' },
    }
    
    const badge = badges[tier]
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    )
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '—'
    const mb = bytes / (1024 * 1024)
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(2)} MB`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const handleDelete = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this upload? This will permanently delete the file, all transactions, and cannot be undone.')) {
      return
    }

    setDeletingId(jobId)
    try {
      const response = await fetch(`/api/categorization/jobs/${jobId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete upload')
      }

      // Remove from local state
      setUploads(uploads.filter(upload => upload.id !== jobId))
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(jobId)
        return next
      })
    } catch (error: any) {
      console.error('Error deleting upload:', error)
      alert(`Failed to delete upload: ${error.message}`)
    } finally {
      setDeletingId(null)
      setShowDeleteConfirm(null)
    }
  }

  const handleSelectAll = () => {
    if (selectedIds.size === uploads.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(uploads.map(u => u.id)))
    }
  }

  const handleToggleSelect = (jobId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(jobId)) {
        next.delete(jobId)
      } else {
        next.add(jobId)
      }
      return next
    })
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one file to delete')
      return
    }

    const count = selectedIds.size
    if (!confirm(`Are you sure you want to delete ${count} file${count > 1 ? 's' : ''}? This will permanently delete the files, all transactions, and cannot be undone.`)) {
      return
    }

    setBulkDeleting(true)
    try {
      const response = await fetch('/api/categorization/jobs/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobIds: Array.from(selectedIds) }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete files')
      }

      // Refresh the uploads list
      await fetchUploads()
      setSelectedIds(new Set())
    } catch (error: any) {
      console.error('Error bulk deleting uploads:', error)
      alert(`Failed to delete files: ${error.message}`)
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleResetStorage = async () => {
    if (!confirm('Are you sure you want to reset the entire storage facility? This will permanently delete ALL uploaded files, transactions, and cannot be undone. This action is irreversible.')) {
      return
    }

    if (!confirm('This is your final warning. Are you absolutely sure you want to delete ALL files?')) {
      return
    }

    setResettingStorage(true)
    try {
      const response = await fetch('/api/categorization/jobs/reset-storage', {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reset storage')
      }

      const result = await response.json()
      // Refresh the uploads list
      await fetchUploads()
      setSelectedIds(new Set())
      alert(`Storage reset successfully. Deleted ${result.deletedCount || 0} file(s).`)
    } catch (error: any) {
      console.error('Error resetting storage:', error)
      alert(`Failed to reset storage: ${error.message}`)
    } finally {
      setResettingStorage(false)
    }
  }

  const handleSyncToSheets = async (jobId: string) => {
    if (connectedSheets.length === 0) {
      alert('No Google Sheets connected. Please connect a Google Sheet in Settings > Integrations first.')
      return
    }

    // Use the first connected sheet (or could show a picker if multiple)
    const sheet = connectedSheets[0]

    setSyncingJobId(jobId)
    try {
      const response = await fetch('/api/sync/google-sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetId: sheet.source_id,
          direction: 'push',
          jobId: jobId,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync to Google Sheets')
      }

      // Refresh uploads to show sync status
      await fetchUploads()
      
      alert(`Successfully synced to Google Sheets! ${result.result?.rows_pushed || 0} rows pushed.`)
    } catch (error: any) {
      console.error('Error syncing to sheets:', error)
      alert(`Failed to sync: ${error.message}`)
    } finally {
      setSyncingJobId(null)
    }
  }

  const openGoogleSheet = (sheetId: string) => {
    window.open(`https://docs.google.com/spreadsheets/d/${sheetId}`, '_blank')
  }

  const handleRetry = async (jobId: string) => {
    setRetryingJobId(jobId)
    try {
      const response = await fetch(`/api/categorization/jobs/${jobId}/retry`, {
        method: 'POST',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to retry job')
      }

      // Refresh uploads to show updated status
      await fetchUploads()
    } catch (error: any) {
      console.error('Error retrying job:', error)
      alert(`Failed to retry: ${error.message}`)
    } finally {
      setRetryingJobId(null)
    }
  }

  const handleCleanupPreview = async (type: string) => {
    try {
      const response = await fetch(`/api/categorization/jobs/cleanup?type=${type}&dryRun=true`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to preview cleanup')
      }

      setCleanupPreview({
        type,
        count: result.count,
        jobs: result.jobs || [],
      })
    } catch (error: any) {
      console.error('Error previewing cleanup:', error)
      alert(`Failed to preview cleanup: ${error.message}`)
    }
  }

  const handleCleanup = async (type: string) => {
    const typeLabels: Record<string, string> = {
      failed: 'failed jobs',
      duplicates: 'duplicate jobs (keeping latest)',
      all_except_latest: 'older versions of each file',
      empty: 'jobs with no transactions',
    }

    if (!confirm(`Are you sure you want to delete all ${typeLabels[type] || type}? This cannot be undone.`)) {
      return
    }

    setCleaningUp(true)
    setCleanupDropdownOpen(false)
    try {
      const response = await fetch(`/api/categorization/jobs/cleanup?type=${type}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to cleanup')
      }

      // Refresh uploads to show updated list
      await fetchUploads()
      alert(`Successfully deleted ${result.deleted} job(s).`)
    } catch (error: any) {
      console.error('Error cleaning up:', error)
      alert(`Failed to cleanup: ${error.message}`)
    } finally {
      setCleaningUp(false)
      setCleanupPreview(null)
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cleanupDropdownRef.current && !cleanupDropdownRef.current.contains(event.target as Node)) {
        setCleanupDropdownOpen(false)
        setCleanupPreview(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Heading>Uploads</Heading>
          <Text>Manage your uploaded files and transactions</Text>
        </div>
        <div className="flex gap-3">
          {selectedIds.size > 0 && (
            <Button 
              color="red" 
              className="gap-2"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <TrashIcon className="h-5 w-5" />
                  Delete Selected ({selectedIds.size})
                </>
              )}
            </Button>
          )}
          <Button 
            color="zinc" 
            className="gap-2"
            onClick={handleResetStorage}
            disabled={resettingStorage || uploads.length === 0}
          >
            {resettingStorage ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                Resetting...
              </>
            ) : (
              <>
                <Squares2X2Icon className="h-5 w-5" />
                Reset Storage
              </>
            )}
          </Button>
          {/* Cleanup Dropdown */}
          <div className="relative" ref={cleanupDropdownRef}>
            <Button
              color="zinc"
              className="gap-2"
              onClick={() => setCleanupDropdownOpen(!cleanupDropdownOpen)}
              disabled={cleaningUp || uploads.length === 0}
            >
              {cleaningUp ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  Cleaning...
                </>
              ) : (
                <>
                  <FunnelIcon className="h-5 w-5" />
                  Clean Up
                  <ChevronDownIcon className="h-4 w-4" />
                </>
              )}
            </Button>
            {cleanupDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-lg shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    Bulk Cleanup Options
                  </div>
                  <button
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between group"
                    onClick={() => handleCleanup('failed')}
                    onMouseEnter={() => handleCleanupPreview('failed')}
                  >
                    <div className="flex items-center gap-2">
                      <XCircleIcon className="h-5 w-5 text-red-500" />
                      <span>Delete All Failed Jobs</span>
                    </div>
                    {cleanupPreview?.type === 'failed' && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {cleanupPreview.count} job{cleanupPreview.count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </button>
                  <button
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between group"
                    onClick={() => handleCleanup('duplicates')}
                    onMouseEnter={() => handleCleanupPreview('duplicates')}
                  >
                    <div className="flex items-center gap-2">
                      <DocumentTextIcon className="h-5 w-5 text-yellow-500" />
                      <span>Delete Duplicate Jobs</span>
                    </div>
                    {cleanupPreview?.type === 'duplicates' && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {cleanupPreview.count} job{cleanupPreview.count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </button>
                  <button
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between group"
                    onClick={() => handleCleanup('empty')}
                    onMouseEnter={() => handleCleanupPreview('empty')}
                  >
                    <div className="flex items-center gap-2">
                      <TrashIcon className="h-5 w-5 text-gray-500" />
                      <span>Delete Jobs with No Transactions</span>
                    </div>
                    {cleanupPreview?.type === 'empty' && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {cleanupPreview.count} job{cleanupPreview.count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </button>
                  <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
                    <button
                      className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-between group"
                      onClick={() => handleCleanup('all_except_latest')}
                      onMouseEnter={() => handleCleanupPreview('all_except_latest')}
                    >
                      <div className="flex items-center gap-2">
                        <ExclamationTriangleIcon className="h-5 w-5" />
                        <span>Keep Only Latest of Each File</span>
                      </div>
                      {cleanupPreview?.type === 'all_except_latest' && (
                        <span className="text-xs">
                          {cleanupPreview.count} job{cleanupPreview.count !== 1 ? 's' : ''}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Link href="/dashboard/uploads/receipts">
            <Button color="zinc" className="gap-2">
              <DocumentTextIcon className="h-5 w-5" />
              Upload Receipts
            </Button>
          </Link>
          <Link href="/dashboard/uploads/bank-statements">
            <Button color="blue" className="gap-2">
              <ArrowUpTrayIcon className="h-5 w-5" />
              Upload Bank Statement
            </Button>
          </Link>
        </div>
      </div>

      {/* Uploads List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <Text>Loading uploads...</Text>
          </div>
        ) : uploads.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-gray-400 dark:text-gray-500 mb-4">
              <ArrowUpTrayIcon className="h-12 w-12 mx-auto" />
            </div>
            <Text className="mb-4">No uploads yet</Text>
            <Link href="/dashboard/uploads/bank-statements">
              <Button color="blue">Upload Your First Statement</Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={uploads.length > 0 && selectedIds.size === uploads.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Filename
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Storage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Bank Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Spreadsheet
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Uploaded
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {uploads.map((upload) => (
                  <tr key={upload.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(upload.id)}
                        onChange={() => handleToggleSelect(upload.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {upload.original_filename}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                            {upload.file_type === 'bank_statement' ? 'Bank Statement' : upload.job_type.replace('_', ' ')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const statusDisplay = getStatusDisplay(upload)
                          const Icon = statusDisplay.icon
                          return (
                            <>
                              <Icon 
                                className={`h-5 w-5 ${statusDisplay.color} ${statusDisplay.spinning ? 'animate-spin' : ''}`} 
                              />
                              <div className="flex flex-col">
                                <span className={`text-sm font-medium ${statusDisplay.color}`}>
                                  {statusDisplay.label}
                                </span>
                                {statusDisplay.message && statusDisplay.message !== statusDisplay.label && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {statusDisplay.message}
                                  </span>
                                )}
                                {upload.status === 'processing' && upload.total_items && upload.processed_items !== undefined && (
                                  <div className="mt-1">
                                    <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                      <div
                                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                        style={{ 
                                          width: `${Math.min((upload.processed_items / upload.total_items) * 100, 100)}%` 
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                      {upload.processed_items} / {upload.total_items}
                                    </span>
                                  </div>
                                )}
                                {upload.status === 'failed' && upload.error_code && (
                                  <details className="mt-1">
                                    <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer hover:underline">
                                      Error details
                                    </summary>
                                    <div className="mt-1 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs">
                                      <div className="font-mono text-red-700 dark:text-red-300">
                                        Code: {upload.error_code}
                                      </div>
                                      {upload.error_message && (
                                        <div className="text-red-600 dark:text-red-400 mt-1">
                                          {upload.error_message}
                                        </div>
                                      )}
                                    </div>
                                  </details>
                                )}
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStorageTierBadge(upload.storage_info?.tier)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatFileSize(upload.storage_info?.total_size_bytes)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {upload.bank_account ? (
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {upload.bank_account.account_name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {upload.bank_account.bank_name}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {upload.spreadsheet_id ? (
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {upload.spreadsheet_id.substring(0, 20)}...
                          </div>
                          {upload.spreadsheet_tab_id && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Tab: {upload.spreadsheet_tab_id}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(upload.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        {/* Ready for Review - show sync and review buttons */}
                        {upload.status === 'reviewing' && (
                          <>
                            <Link href={`/dashboard/review/${upload.id}`}>
                              <Button color="zinc" className="gap-1">
                                <DocumentTextIcon className="h-4 w-4" />
                                Review
                              </Button>
                            </Link>
                            {connectedSheets.length > 0 ? (
                              <Button
                                color="green"
                                onClick={() => handleSyncToSheets(upload.id)}
                                disabled={syncingJobId === upload.id}
                                className="gap-1"
                              >
                                {syncingJobId === upload.id ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Syncing...
                                  </>
                                ) : (
                                  <>
                                    <TableCellsIcon className="h-4 w-4" />
                                    Sync to Sheets
                                  </>
                                )}
                              </Button>
                            ) : (
                              <Link href="/dashboard/settings">
                                <Button color="zinc" className="gap-1">
                                  <TableCellsIcon className="h-4 w-4" />
                                  Connect Sheets
                                </Button>
                              </Link>
                            )}
                          </>
                        )}
                        {/* Completed/Synced - show view options */}
                        {upload.status === 'completed' && (
                          <>
                            <Link href={`/dashboard/review/${upload.id}`}>
                              <Button color="blue" className="gap-1">
                                <DocumentTextIcon className="h-4 w-4" />
                                View
                              </Button>
                            </Link>
                            {connectedSheets.length > 0 && (
                              <Button
                                color="zinc"
                                onClick={() => openGoogleSheet(connectedSheets[0].source_id)}
                                className="gap-1"
                              >
                                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                                Open Sheet
                              </Button>
                            )}
                          </>
                        )}
                        {/* Processing states */}
                        {['received', 'queued', 'processing'].includes(upload.status) && (
                          <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <ClockIcon className="h-4 w-4" />
                            {upload.status === 'processing' ? 'Processing...' : 'Waiting...'}
                          </span>
                        )}
                        {/* Failed - show retry button */}
                        {upload.status === 'failed' && (
                          <Button
                            color="amber"
                            onClick={() => handleRetry(upload.id)}
                            disabled={retryingJobId === upload.id}
                            className="gap-1"
                          >
                            {retryingJobId === upload.id ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Retrying...
                              </>
                            ) : (
                              <>
                                <ArrowPathIcon className="h-4 w-4" />
                                Retry
                              </>
                            )}
                          </Button>
                        )}
                        {/* Delete button always available */}
                        <Button
                          color="red"
                          onClick={() => handleDelete(upload.id)}
                          disabled={deletingId === upload.id}
                          className="gap-1"
                        >
                          {deletingId === upload.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <TrashIcon className="h-4 w-4" />
                              Delete
                            </>
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

