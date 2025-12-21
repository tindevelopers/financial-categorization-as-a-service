'use client'

import { useState, useEffect } from 'react'
import { Heading, Text, Button } from '@/components/catalyst'
import { ArrowUpTrayIcon, DocumentTextIcon, ClockIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { createClient } from '@/core/database/client'

interface Upload {
  id: string
  filename: string
  status: string
  created_at: string
  transaction_count?: number
}

export default function UploadsPage() {
  const [uploads, setUploads] = useState<Upload[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUploads() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('categorization_jobs')
          .select('id, filename, status, created_at')
          .order('created_at', { ascending: false })
          .limit(20)

        if (error) {
          console.error('Error fetching uploads:', error)
        } else {
          setUploads(data || [])
        }
      } catch (error) {
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
                            {upload.filename}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium capitalize ${getStatusColor(upload.status)}`}>
                        {upload.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(upload.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {upload.status === 'completed' && (
                        <Link href={`/review/${upload.id}`}>
                          <Button color="blue" size="sm">
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

