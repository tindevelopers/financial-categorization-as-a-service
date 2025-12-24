'use client'

import { useState, useEffect } from 'react'
import { Heading, Text, Button } from '@/components/catalyst'
import { CloudIcon, CheckCircleIcon, XCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

interface CloudIntegration {
  id: string
  provider: 'google_drive' | 'dropbox' | 'box' | 'onedrive'
  folder_name: string
  sync_frequency: string
  last_sync_at?: string
  last_sync_status: string
  files_synced: number
  is_active: boolean
}

const PROVIDER_INFO = {
  google_drive: {
    name: 'Google Drive',
    description: 'Automatically sync receipts from your Drive',
    icon: '📁',
  },
  dropbox: {
    name: 'Dropbox',
    description: 'Sync files from your Dropbox folder',
    icon: '📦',
  },
  box: {
    name: 'Box',
    description: 'Connect your Box account for syncing',
    icon: '📂',
  },
  onedrive: {
    name: 'OneDrive',
    description: 'Sync from your Microsoft OneDrive',
    icon: '☁️',
  },
}

export default function CloudStoragePage() {
  const [integrations, setIntegrations] = useState<CloudIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)

  useEffect(() => {
    loadIntegrations()
  }, [])

  const loadIntegrations = async () => {
    try {
      setLoading(true)
      // TODO: Implement API endpoint
      // const response = await fetch('/api/integrations/cloud-storage')
      // const data = await response.json()
      // setIntegrations(data.integrations || [])
      setIntegrations([]) // Placeholder
    } catch (error) {
      console.error('Failed to load integrations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (provider: string) => {
    // Redirect to OAuth flow
    window.location.href = `/api/integrations/cloud-storage/connect?provider=${provider}`
  }

  const handleSync = async (integrationId: string) => {
    try {
      setSyncing(integrationId)
      const response = await fetch(`/api/integrations/cloud-storage/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId }),
      })

      if (response.ok) {
        await loadIntegrations()
      }
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setSyncing(null)
    }
  }

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm('Are you sure you want to disconnect this integration?')) return

    try {
      const response = await fetch(`/api/integrations/cloud-storage/${integrationId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadIntegrations()
      }
    } catch (error) {
      console.error('Disconnect failed:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    }

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || colors.pending}`}>
        {status}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Heading>Cloud Storage Integrations</Heading>
          <Text>Connect cloud storage for automatic document sync</Text>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Heading>Cloud Storage Integrations</Heading>
        <Text>Automatically sync receipts and invoices from your cloud storage</Text>
      </div>

      {/* Connected Integrations */}
      {integrations.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Connected Services
          </h3>
          {integrations.map((integration) => {
            const info = PROVIDER_INFO[integration.provider]
            return (
              <div
                key={integration.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="text-4xl">{info.icon}</div>
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {info.name}
                      </h4>
                      <Text className="text-sm mb-2">{integration.folder_name}</Text>
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span>{getStatusBadge(integration.last_sync_status)}</span>
                        <span>{integration.files_synced} files synced</span>
                        {integration.last_sync_at && (
                          <span>
                            Last sync:{' '}
                            {new Date(integration.last_sync_at).toLocaleString('en-GB')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      outline
                      onClick={() => handleSync(integration.id)}
                      disabled={syncing === integration.id}
                    >
                      <ArrowPathIcon className="h-4 w-4 mr-1" />
                      {syncing === integration.id ? 'Syncing...' : 'Sync Now'}
                    </Button>
                    <Button plain onClick={() => handleDisconnect(integration.id)}>
                      Disconnect
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Available Providers */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Available Services
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(PROVIDER_INFO).map(([key, info]) => {
            const isConnected = integrations.some(i => i.provider === key)
            return (
              <div
                key={key}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{info.icon}</div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      {info.name}
                      {isConnected && (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      )}
                    </h4>
                    <Text className="text-sm">{info.description}</Text>
                    <Button
                      color="blue"
                      className="mt-4"
                      onClick={() => handleConnect(key)}
                      disabled={isConnected}
                    >
                      {isConnected ? 'Connected' : 'Connect'}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

