'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Heading, Text, Button, Badge } from '@/components/catalyst'
import { 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  LinkIcon,
} from '@heroicons/react/24/outline'

export default function GoogleSheetsIntegrationPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [providerEmail, setProviderEmail] = useState<string | null>(null)

  useEffect(() => {
    checkConnection()
    
    // Check for query params
    const connectedParam = searchParams.get('connected')
    const errorParam = searchParams.get('error')
    
    if (connectedParam === 'true') {
      setConnected(true)
      setError(null)
      checkConnection()
    } else if (errorParam) {
      setError(getErrorMessage(errorParam))
      setConnected(false)
    }
  }, [searchParams])

  const checkConnection = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/integrations/google-sheets/list')
      const data = await response.json()

      if (response.ok && data.success) {
        setConnected(true)
        setError(null)
      } else if (data.error_code === 'NOT_CONNECTED') {
        setConnected(false)
        setError(null)
      } else if (data.error_code === 'NOT_CONFIGURED') {
        setConnected(false)
        setError('Google Sheets integration is not configured. Please contact your administrator.')
      } else {
        setConnected(false)
        setError(data.error || 'Unable to check connection status')
      }
    } catch (err: any) {
      console.error('Error checking connection:', err)
      setConnected(false)
      setError('Failed to check connection status')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    try {
      setConnecting(true)
      setError(null)
      window.location.href = '/api/integrations/google-sheets/connect'
    } catch (err: any) {
      console.error('Error connecting:', err)
      setError(err.message || 'Failed to initiate connection')
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      const response = await fetch('/api/integrations/google-sheets/disconnect', {
        method: 'POST',
      })
      
      if (response.ok) {
        setConnected(false)
        setProviderEmail(null)
        router.push('/dashboard/integrations/google-sheets?disconnected=true')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to disconnect')
      }
    } catch (err: any) {
      console.error('Error disconnecting:', err)
      setError('Failed to disconnect')
    }
  }

  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'unauthorized':
        return 'You must be signed in to connect Google Sheets.'
      case 'invalid_state':
        return 'Invalid security token. Please try again.'
      case 'no_code':
        return 'Authorization was cancelled or failed.'
      case 'no_access_token':
        return 'Failed to obtain access token from Google.'
      case 'database_error':
        return 'Failed to save connection. Please try again.'
      case 'configuration_error':
        return 'Server configuration error. Please contact support.'
      case 'callback_failed':
        return 'Connection callback failed. Please try again.'
      default:
        return 'An error occurred during connection.'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Heading>Google Sheets Integration</Heading>
          <Text className="mt-2">
            Connect your Google account to access and export to Google Sheets
          </Text>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <Text className="mt-4">Checking connection status...</Text>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading>Google Sheets Integration</Heading>
          <Text className="mt-2">
            Connect your Google account to access and export to Google Sheets
          </Text>
        </div>
        {connected && (
          <Button onClick={checkConnection} outline className="gap-2">
            <ArrowPathIcon className="h-5 w-5" />
            Refresh
          </Button>
        )}
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
          </div>
        </div>
      )}

      {searchParams.get('disconnected') === 'true' && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
          <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Disconnected
            </p>
            <p className="text-sm text-green-600 dark:text-green-300 mt-1">
              Google Sheets integration has been disconnected successfully.
            </p>
          </div>
        </div>
      )}

      {connected ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Connected to Google Sheets
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Your Google account is connected and ready to use.
                </p>
                {providerEmail && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                    Connected as: <span className="font-medium">{providerEmail}</span>
                  </p>
                )}
                <div className="mt-4 flex items-center gap-4">
                  <Badge color="green">Active</Badge>
                  <a
                    href="/dashboard/settings/spreadsheets"
                    className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <LinkIcon className="h-4 w-4" />
                    View Available Spreadsheets
                  </a>
                </div>
              </div>
            </div>
            <Button
              onClick={handleDisconnect}
              outline
            >
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <div className="text-center py-8">
            <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
              <svg
                className="h-8 w-8 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Connect Google Sheets
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Connect your Google account to access your spreadsheets and export categorized transactions directly to Google Sheets.
            </p>
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="gap-2"
            >
              {connecting ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Connect with Google
                </>
              )}
            </Button>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
              You'll be redirected to Google to authorize access
            </p>
          </div>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 mt-6">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">
          What you can do with Google Sheets integration:
        </h4>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span>View all Google Sheets you have access to</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span>Export categorized transactions directly to Google Sheets</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span>Use spreadsheet IDs when configuring bank accounts</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span>Automatically sync data to your spreadsheets</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

