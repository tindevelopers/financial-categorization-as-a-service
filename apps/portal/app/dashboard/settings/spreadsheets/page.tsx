'use client'

import { useState, useEffect } from 'react'
import { Heading, Text, Button, Badge } from '@/components/catalyst'
import { 
  DocumentTextIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  LinkIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline'

interface SpreadsheetTab {
  id: string
  title: string
  index: number
}

interface Spreadsheet {
  id: string
  name: string
  url: string
  createdTime?: string
  modifiedTime?: string
  tabs: SpreadsheetTab[]
  owner: string
  error?: string
}

export default function SpreadsheetsPage() {
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchSpreadsheets()
  }, [])

  const fetchSpreadsheets = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/integrations/google-sheets/list')
      const data = await response.json()

      if (!response.ok) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'spreadsheets/page.tsx:45',message:'API response not OK',data:{status:response.status,statusText:response.statusText,errorCode:data.error_code,error:data.error},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H'})}).catch(()=>{});
        // #endregion
        
        if (data.error_code === 'NOT_CONNECTED') {
          setError('Google Sheets integration not connected. Please connect your Google account in Settings.')
        } else if (data.error_code === 'NOT_CONFIGURED') {
          setError('Google Sheets API not configured. Service account credentials are required. Please configure GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY environment variables.')
        } else if (response.status === 401) {
          setError('Unauthorized. Please sign in and try again.')
        } else {
          setError(data.error || `Failed to fetch spreadsheets (${response.status})`)
        }
        setSpreadsheets([])
        return
      }

      if (data.success) {
        setSpreadsheets(data.spreadsheets || [])
      } else {
        setError('Failed to fetch spreadsheets')
        setSpreadsheets([])
      }
    } catch (err: any) {
      console.error('Error fetching spreadsheets:', err)
      setError(err.message || 'Failed to fetch spreadsheets')
      setSpreadsheets([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchSpreadsheets()
  }

  const copySpreadsheetId = (id: string) => {
    navigator.clipboard.writeText(id)
    // You could add a toast notification here
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Heading>Available Spreadsheets</Heading>
            <Text className="mt-2">
              View all Google Sheets you have access to
            </Text>
          </div>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <Text className="mt-4">Loading spreadsheets...</Text>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading>Available Spreadsheets</Heading>
          <Text className="mt-2">
            View all Google Sheets you have access to. Use the spreadsheet ID when configuring bank accounts.
          </Text>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} className="gap-2">
          <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Error
            </p>
            <p className="text-sm text-red-600 dark:text-red-300 mt-1">
              {error}
            </p>
            {error.includes('not connected') && (
              <a
                href="/dashboard/integrations/google-sheets"
                className="mt-2 inline-block text-sm text-red-700 dark:text-red-400 underline"
              >
                Connect Google Sheets Integration
              </a>
            )}
            {error.includes('not configured') && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-300">
                Please contact your administrator to configure Google Sheets integration.
              </p>
            )}
          </div>
        </div>
      )}

      {!error && spreadsheets.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
          <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <Text className="mb-4">No spreadsheets found</Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            Make sure you have Google Sheets integration connected and have access to at least one spreadsheet.
          </Text>
        </div>
      )}

      {spreadsheets.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <Heading level={3}>
                {spreadsheets.length} Spreadsheet{spreadsheets.length !== 1 ? 's' : ''}
              </Heading>
              <Badge color="green">{spreadsheets.length} available</Badge>
            </div>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {spreadsheets.map((spreadsheet) => (
              <div key={spreadsheet.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <DocumentTextIcon className="h-6 w-6 text-gray-400" />
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white text-lg">
                          {spreadsheet.name}
                        </h4>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                          <span>Owner: {spreadsheet.owner}</span>
                          {spreadsheet.modifiedTime && (
                            <span>Modified: {formatDate(spreadsheet.modifiedTime)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {spreadsheet.error && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                        <ExclamationTriangleIcon className="h-4 w-4" />
                        <span>Could not load tabs: {spreadsheet.error}</span>
                      </div>
                    )}

                    {spreadsheet.tabs.length > 0 && (
                      <div className="mt-3">
                        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Tabs ({spreadsheet.tabs.length}):
                        </Text>
                        <div className="flex flex-wrap gap-2">
                          {spreadsheet.tabs.map((tab) => (
                            <Badge key={tab.id} color="zinc">
                              {tab.title}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Text className="text-xs font-mono text-gray-600 dark:text-gray-400">
                          ID: {spreadsheet.id}
                        </Text>
                        <button
                          onClick={() => copySpreadsheetId(spreadsheet.id)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          title="Copy spreadsheet ID"
                        >
                          <ClipboardDocumentIcon className="h-4 w-4 text-gray-500" />
                        </button>
                      </div>
                      <a
                        href={spreadsheet.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <LinkIcon className="h-4 w-4" />
                        Open in Google Sheets
                      </a>
                    </div>
                  </div>
                  <div className="ml-4">
                    <CheckCircleIcon className="h-6 w-6 text-green-500" title="Accessible" />
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

