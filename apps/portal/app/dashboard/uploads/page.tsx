'use client'

import { useState, useEffect } from 'react'
import { Heading, Text, Button } from '@/components/catalyst'
import { ArrowUpTrayIcon, DocumentTextIcon, ClockIcon, TrashIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { createClient } from '@/core/database/client'

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
  created_at: string
  job_type: string
  total_items?: number
  processed_items?: number
  storage_info?: StorageInfo
}

export default function UploadsPage() {
  const [uploads, setUploads] = useState<Upload[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    async function fetchUploads() {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'uploads/page.tsx:23',message:'fetchUploads started',data:{hasSupabaseUrl:!!process.env.NEXT_PUBLIC_SUPABASE_URL,hasSupabaseKey:!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      try {
        // Use the new API endpoint that includes storage info
        const response = await fetch('/api/categorization/jobs?limit=20')
        
        if (!response.ok) {
          throw new Error('Failed to fetch uploads')
        }

        const result = await response.json()
        setUploads(result.jobs || [])
      } catch (error: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'uploads/page.tsx:50',message:'fetchUploads exception',data:{errorMessage:error?.message || 'unknown',errorType:error?.constructor?.name || 'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        console.error('Error fetching uploads:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUploads()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 dark:text-green-400'
      case 'processing':
        return 'text-blue-600 dark:text-blue-400'
      case 'failed':
        return 'text-red-600 dark:text-red-400'
      default:
    return 'text-gray-600 dark:text-gray-400'
  }
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
    } catch (error: any) {
      console.error('Error deleting upload:', error)
      alert(`Failed to delete upload: ${error.message}`)
    } finally {
      setDeletingId(null)
      setShowDeleteConfirm(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Heading>Uploads</Heading>
          <Text>Manage your uploaded files and transactions</Text>
        </div>
        <div className="flex gap-3">
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
                      <div className="flex items-center gap-3">
                        <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {upload.original_filename}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                            {upload.job_type.replace('_', ' ')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium capitalize ${getStatusColor(upload.status)}`}>
                        {upload.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStorageTierBadge(upload.storage_info?.tier)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatFileSize(upload.storage_info?.total_size_bytes)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(upload.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        {upload.status === 'completed' && (
                          <Link href={`/review/${upload.id}`}>
                            <Button color="blue">
                              View
                            </Button>
                          </Link>
                        )}
                        {upload.status === 'processing' && (
                          <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <ClockIcon className="h-4 w-4" />
                            Processing...
                          </span>
                        )}
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

