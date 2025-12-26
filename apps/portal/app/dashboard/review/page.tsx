"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  TrashIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline"

// Component version marker for debugging - UPDATE THIS TO BUST CACHE
const COMPONENT_VERSION = "v2.1-with-bulk-actions-2025-12-25-cache-bust"
const BUILD_TIMESTAMP = Date.now()
const IS_PRODUCTION = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')
const BUILD_ENV = process.env.NODE_ENV || 'unknown'

interface Job {
  id: string
  original_filename: string | null
  status: string
  total_items: number | null
  processed_items: number | null
  failed_items: number | null
  created_at: string
  updated_at: string
  is_duplicate?: boolean
  duplicate_group_id?: string | null
  file_hash?: string | null
  normalized_filename?: string | null
}

interface GroupedJobs {
  [key: string]: Job[]
}

export default function ReviewJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkRereviewing, setBulkRereviewing] = useState(false)

  useEffect(() => {
    const logData = {
      componentVersion: COMPONENT_VERSION,
      isProduction: IS_PRODUCTION,
      buildEnv: BUILD_ENV,
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'server',
      timestamp: Date.now(),
      selectedIdsSize: selectedIds.size,
      jobsCount: jobs.length,
      loading,
      hasCheckboxes: true,
      hasBulkActions: true,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    };
    // Log to console for production debugging (visible in browser console)
    console.log('[ReviewPage] Component mounted:', logData);
    // Also send to debug server if available (localhost only)
    if (!IS_PRODUCTION) {
    }
  }, []);

  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    try {
      const response = await fetch("/api/categorization/jobs", {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })
      
      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch (e) {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` }
        }
        throw new Error(errorData.error || errorData.details || `Failed to load jobs (${response.status})`)
      }
      
      const data = await response.json()
      const jobsList = data.jobs || []
      setJobs(jobsList)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedIds.size === jobs.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(jobs.map(j => j.id)))
    }
  }

  const handleToggleSelect = (jobId: string) => {
    const logData = {
      jobId,
      currentSelected: selectedIds.has(jobId),
      selectedCount: selectedIds.size,
      isProduction: IS_PRODUCTION,
      componentVersion: COMPONENT_VERSION
    };
    console.log('[ReviewPage] Checkbox clicked:', logData);
    if (!IS_PRODUCTION) {
    }
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(jobId)) {
        next.delete(jobId)
      } else {
        next.add(jobId)
      }
      const updateLogData = {
        newSelectedCount: next.size,
        willShowButtons: next.size > 0,
        isProduction: IS_PRODUCTION,
        componentVersion: COMPONENT_VERSION
      };
      console.log('[ReviewPage] Selection updated:', updateLogData);
      if (!IS_PRODUCTION) {
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

      // Refresh the jobs list
      await loadJobs()
      setSelectedIds(new Set())
    } catch (error: any) {
      console.error('Error bulk deleting jobs:', error)
      alert(`Failed to delete files: ${error.message}`)
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleBulkRereview = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one file to re-review')
      return
    }

    const count = selectedIds.size
    if (!confirm(`Re-review ${count} file${count > 1 ? 's' : ''}? This will reprocess the files and regenerate transactions.`)) {
      return
    }

    setBulkRereviewing(true)
    try {
      const response = await fetch('/api/categorization/jobs/bulk-rereview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobIds: Array.from(selectedIds) }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to re-review files')
      }

      const data = await response.json()
      
      // Refresh the jobs list
      await loadJobs()
      setSelectedIds(new Set())
      
      // Show success message
      if (data.errorCount > 0) {
        alert(`${data.message}\n\nErrors:\n${data.errors?.join('\n') || 'Unknown errors'}`)
      } else {
        alert(data.message || `Successfully queued ${count} file${count > 1 ? 's' : ''} for re-review`)
      }
    } catch (error: any) {
      console.error('Error bulk re-reviewing jobs:', error)
      alert(`Failed to re-review files: ${error.message}`)
    } finally {
      setBulkRereviewing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
      case "reviewing":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircleIcon className="h-3 w-3" />
            {status === "reviewing" ? "Ready for Review" : "Completed"}
          </span>
        )
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            <ClockIcon className="h-3 w-3" />
            Processing
          </span>
        )
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <ExclamationCircleIcon className="h-3 w-3" />
            Failed
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
            {status}
          </span>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">{error}</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* #region agent log - Version indicator for deployment verification */}
      <div className="mb-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-300" style={{fontFamily:'monospace'}}>
        Component Version: {COMPONENT_VERSION} | Build: {BUILD_TIMESTAMP} | Env: {BUILD_ENV} | Host: {typeof window !== 'undefined' ? window.location.hostname : 'server'} | Production: {IS_PRODUCTION ? 'Yes' : 'No'}
      </div>
      {/* #endregion */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Review Transactions
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Review and confirm your categorized bank statements
          </p>
        </div>
        <div className="flex gap-3">
          {/* #region agent log */}
          {(() => {
            const logData = {
              selectedIdsSize: selectedIds.size,
              shouldShowButtons: selectedIds.size > 0,
              hasCheckboxes: true,
              isProduction: IS_PRODUCTION,
              componentVersion: COMPONENT_VERSION
            };
            console.log('[ReviewPage] Rendering bulk actions:', logData);
            if (!IS_PRODUCTION) {
            }
            return null;
          })()}
          {/* #endregion */}
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={handleBulkRereview}
                disabled={bulkRereviewing || bulkDeleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkRereviewing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Re-reviewing...
                  </>
                ) : (
                  <>
                    <ArrowPathIcon className="h-5 w-5" />
                    Re-review Selected ({selectedIds.size})
                  </>
                )}
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting || bulkRereviewing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
              </button>
            </>
          )}
          <Link
            href="/dashboard/uploads/bank-statements"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Upload New Statement
          </Link>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700">
          <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No jobs yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Upload a bank statement to start categorizing your transactions
          </p>
          <Link
            href="/dashboard/uploads/bank-statements"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Upload Statement
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
            <thead className="bg-gray-50 dark:bg-zinc-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                  {/* #region agent log */}
                  {(() => {
                    const logData = {
                      jobsCount: jobs.length,
                      selectedCount: selectedIds.size,
                      isChecked: jobs.length > 0 && selectedIds.size === jobs.length,
                      isProduction: IS_PRODUCTION,
                      componentVersion: COMPONENT_VERSION
                    };
                    console.log('[ReviewPage] Rendering select all checkbox:', logData);
                    if (!IS_PRODUCTION) {
                    }
                    return null;
                  })()}
                  {/* #endregion */}
                  <input
                    type="checkbox"
                    checked={jobs.length > 0 && selectedIds.size === jobs.length}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    data-testid="select-all-checkbox"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  File
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
              {(() => {
                // Group jobs by duplicate_group_id or file_hash for visual grouping
                const grouped: GroupedJobs = {}
                const ungrouped: Job[] = []

                jobs.forEach(job => {
                  const groupKey = job.duplicate_group_id || job.file_hash || job.normalized_filename
                  if (groupKey && (job.is_duplicate || jobs.filter(j => 
                    j.duplicate_group_id === job.duplicate_group_id || 
                    j.file_hash === job.file_hash ||
                    j.normalized_filename === job.normalized_filename
                  ).length > 1)) {
                    if (!grouped[groupKey]) {
                      grouped[groupKey] = []
                    }
                    grouped[groupKey].push(job)
                  } else {
                    ungrouped.push(job)
                  }
                })

                // Sort grouped jobs by date (oldest first)
                Object.keys(grouped).forEach(key => {
                  grouped[key].sort((a, b) => 
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  )
                })

                const allJobs: Array<{ job: Job; isGrouped: boolean; groupIndex?: number; groupSize?: number }> = []
                
                // Add grouped jobs
                Object.values(grouped).forEach(group => {
                  group.forEach((job, index) => {
                    allJobs.push({
                      job,
                      isGrouped: true,
                      groupIndex: index,
                      groupSize: group.length,
                    })
                  })
                })

                // Add ungrouped jobs
                ungrouped.forEach(job => {
                  allJobs.push({ job, isGrouped: false })
                })

                return allJobs.map(({ job, isGrouped, groupIndex, groupSize }) => (
                  <tr 
                    key={job.id} 
                    className={`hover:bg-gray-50 dark:hover:bg-zinc-800 ${
                      isGrouped && groupIndex === 0 ? 'border-t-2 border-orange-300 dark:border-orange-700' : ''
                    } ${
                      isGrouped ? 'bg-orange-50/30 dark:bg-orange-900/10' : ''
                    }`}
                  >
                  <td className="px-6 py-4 whitespace-nowrap">
                    {/* #region agent log */}
                    {(() => {
                      if (groupIndex === 0 || (!isGrouped && allJobs.findIndex(({job: j}) => j.id === job.id) === 0)) {
                        const logData = {
                          jobId: job.id,
                          isSelected: selectedIds.has(job.id),
                          totalSelected: selectedIds.size,
                          isProduction: IS_PRODUCTION,
                          componentVersion: COMPONENT_VERSION
                        };
                        console.log('[ReviewPage] Rendering row checkbox:', logData);
                        if (!IS_PRODUCTION) {
                        }
                      }
                      return null;
                    })()}
                    {/* #endregion */}
                    <input
                      type="checkbox"
                      checked={selectedIds.has(job.id)}
                      onChange={() => handleToggleSelect(job.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      data-testid={`checkbox-${job.id}`}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {job.original_filename || "Untitled"}
                        </span>
                        {job.is_duplicate && (
                          <span className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                            Duplicate file detected
                          </span>
                        )}
                        {job.failed_items && job.failed_items > 0 && (
                          <span className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                            {job.failed_items} duplicate transaction{job.failed_items > 1 ? 's' : ''} skipped
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {getStatusBadge(job.status)}
                      {job.is_duplicate && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                          <ExclamationCircleIcon className="h-3 w-3" />
                          Duplicate
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{
                            width: `${job.total_items && job.total_items > 0 ? ((job.processed_items || 0) / job.total_items) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {job.processed_items || 0}/{job.total_items || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(job.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/dashboard/review/${job.id}`}
                      className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
