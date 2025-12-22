'use client'

import { useState, useEffect } from 'react'
import { Heading, Text, Button, Badge } from '@/components/catalyst'
import {
  Cog6ToothIcon,
  LinkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'

interface IntegrationStatus {
  googleSheets: {
    connected: boolean
    email?: string
    connectedAt?: string
  }
}

export default function SettingsPage() {
  const [integrations, setIntegrations] = useState<IntegrationStatus>({
    googleSheets: { connected: false }
  })
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    checkIntegrationStatus()
  }, [])

  const checkIntegrationStatus = async () => {
    try {
      const response = await fetch('/api/integrations/google-sheets/status')
      if (response.ok) {
        const data = await response.json()
        setIntegrations({ googleSheets: data })
      }
    } catch (error) {
      console.error('Failed to check integration status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnectGoogleSheets = async () => {
    setConnecting(true)
    try {
      const response = await fetch('/api/integrations/google-sheets/auth-url')
      if (response.ok) {
        const data = await response.json()
        // Open OAuth flow in new window
        window.location.href = data.authUrl
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to start Google Sheets connection')
      }
    } catch (error) {
      console.error('Failed to connect Google Sheets:', error)
      alert('Failed to connect Google Sheets. Please try again.')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnectGoogleSheets = async () => {
    if (!confirm('Are you sure you want to disconnect Google Sheets? You will need to reconnect to export to Google Sheets again.')) {
      return
    }
    
    setDisconnecting(true)
    try {
      const response = await fetch('/api/integrations/google-sheets/disconnect', {
        method: 'POST',
      })
      if (response.ok) {
        setIntegrations({ googleSheets: { connected: false } })
      } else {
        alert('Failed to disconnect Google Sheets')
      }
    } catch (error) {
      console.error('Failed to disconnect Google Sheets:', error)
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="space-y-8 p-6">
      <div>
        <Heading>Settings</Heading>
        <Text>Manage your account and integrations</Text>
      </div>

      {/* Integrations Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Integrations
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Connect external services to enhance your workflow
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Google Sheets Integration */}
          <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white dark:bg-zinc-700 rounded-lg flex items-center justify-center shadow-sm">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="2" fill="#0F9D58"/>
                  <rect x="5" y="5" width="14" height="14" rx="1" fill="#FFFFFF"/>
                  <rect x="7" y="7" width="4" height="2" fill="#34A853"/>
                  <rect x="13" y="7" width="4" height="2" fill="#34A853"/>
                  <rect x="7" y="11" width="4" height="2" fill="#34A853"/>
                  <rect x="13" y="11" width="4" height="2" fill="#34A853"/>
                  <rect x="7" y="15" width="4" height="2" fill="#34A853"/>
                  <rect x="13" y="15" width="4" height="2" fill="#34A853"/>
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Google Sheets</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Export your categorized transactions directly to Google Sheets for easy sharing and analysis.
                </p>
                {loading ? (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-500">Checking status...</span>
                  </div>
                ) : integrations.googleSheets.connected ? (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600 dark:text-green-400">Connected</span>
                    </div>
                    {integrations.googleSheets.email && (
                      <p className="text-xs text-gray-500">
                        Account: {integrations.googleSheets.email}
                      </p>
                    )}
                    {integrations.googleSheets.connectedAt && (
                      <p className="text-xs text-gray-500">
                        Connected: {new Date(integrations.googleSheets.connectedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2">
                    <ExclamationCircleIcon className="h-4 w-4 text-amber-500" />
                    <span className="text-sm text-amber-600 dark:text-amber-400">Not connected</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-shrink-0">
              {integrations.googleSheets.connected ? (
                <Button
                  color="red"
                  onClick={handleDisconnectGoogleSheets}
                  disabled={disconnecting}
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              ) : (
                <Button
                  color="blue"
                  onClick={handleConnectGoogleSheets}
                  disabled={connecting || loading}
                >
                  {connecting ? 'Connecting...' : 'Connect'}
                </Button>
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
              Why connect Google Sheets?
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <li>• Export categorized transactions with one click</li>
              <li>• Share financial reports with your accountant</li>
              <li>• Create custom dashboards and charts</li>
              <li>• Keep a cloud backup of your transactions</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Coming Soon Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Cog6ToothIcon className="h-5 w-5" />
            More Settings
          </h2>
        </div>
        <div className="p-6 text-center py-12">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-4 inline-flex mb-4">
            <Cog6ToothIcon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            More Settings Coming Soon
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Account preferences, notification settings, and more integrations will be available soon.
          </p>
        </div>
      </div>
    </div>
  )
}
