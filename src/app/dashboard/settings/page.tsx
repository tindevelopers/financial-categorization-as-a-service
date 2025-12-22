'use client'

import { useState, useEffect } from 'react'
import { Heading, Text, Button, Badge } from '@/components/catalyst'
import {
  Cog6ToothIcon,
  LinkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  BuildingOfficeIcon,
  UserIcon,
  EyeIcon,
  EyeSlashIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'

type EntityType = 'individual' | 'company'

interface IntegrationStatus {
  googleSheets: {
    connected: boolean
    email?: string
    connectedAt?: string
  }
  airtable: {
    connected: boolean
    baseId?: string
  }
}

interface TenantSettings {
  provider: string
  custom_client_id?: string
  custom_client_secret?: string
  custom_redirect_uri?: string
  airtable_api_key?: string
  airtable_base_id?: string
  airtable_table_name?: string
  use_custom_credentials?: boolean
  is_enabled?: boolean
}

interface CompanyProfile {
  company_name: string
  company_type: string
}

export default function SettingsPage() {
  const [entityType, setEntityType] = useState<EntityType>('individual')
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null)
  const [integrations, setIntegrations] = useState<IntegrationStatus>({
    googleSheets: { connected: false },
    airtable: { connected: false },
  })
  const [tenantSettings, setTenantSettings] = useState<TenantSettings[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'google' | 'airtable'>('google')
  
  // Form state for custom credentials
  const [useCustomCredentials, setUseCustomCredentials] = useState(false)
  const [customClientId, setCustomClientId] = useState('')
  const [customClientSecret, setCustomClientSecret] = useState('')
  const [showClientSecret, setShowClientSecret] = useState(false)
  
  // Airtable form state
  const [airtableApiKey, setAirtableApiKey] = useState('')
  const [airtableBaseId, setAirtableBaseId] = useState('')
  const [airtableTableName, setAirtableTableName] = useState('Transactions')
  const [showAirtableKey, setShowAirtableKey] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      // Load entity type and tenant settings
      const settingsResponse = await fetch('/api/tenant-settings/integrations')
      if (settingsResponse.ok) {
        const data = await settingsResponse.json()
        setEntityType(data.entityType || 'individual')
        setCompanyProfile(data.companyProfile || null)
        setTenantSettings(data.settings || [])
        
        // Populate form with existing settings
        const googleSettings = data.settings?.find((s: TenantSettings) => s.provider === 'google_sheets')
        if (googleSettings) {
          setUseCustomCredentials(googleSettings.use_custom_credentials || false)
          setCustomClientId(googleSettings.custom_client_id || '')
          // Secret is masked, don't overwrite with masked value
        }
        
        const airtableSettings = data.settings?.find((s: TenantSettings) => s.provider === 'airtable')
        if (airtableSettings) {
          setAirtableBaseId(airtableSettings.airtable_base_id || '')
          setAirtableTableName(airtableSettings.airtable_table_name || 'Transactions')
        }
      }

      // Load Google Sheets connection status
      const gsResponse = await fetch('/api/integrations/google-sheets/status')
      if (gsResponse.ok) {
        const gsData = await gsResponse.json()
        setIntegrations(prev => ({ ...prev, googleSheets: gsData }))
      }

      // Load Airtable connection status
      const airtableResponse = await fetch('/api/integrations/airtable/status')
      if (airtableResponse.ok) {
        const airtableData = await airtableResponse.json()
        setIntegrations(prev => ({ ...prev, airtable: airtableData }))
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
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
    if (!confirm('Are you sure you want to disconnect Google Sheets?')) {
      return
    }
    
    setDisconnecting(true)
    try {
      const response = await fetch('/api/integrations/google-sheets/disconnect', {
        method: 'POST',
      })
      if (response.ok) {
        setIntegrations(prev => ({ ...prev, googleSheets: { connected: false } }))
      } else {
        alert('Failed to disconnect Google Sheets')
      }
    } catch (error) {
      console.error('Failed to disconnect Google Sheets:', error)
    } finally {
      setDisconnecting(false)
    }
  }

  const handleSaveGoogleSettings = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/tenant-settings/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'google_sheets',
          use_custom_credentials: useCustomCredentials,
          custom_client_id: useCustomCredentials ? customClientId : null,
          custom_client_secret: useCustomCredentials && customClientSecret !== '••••••••' 
            ? customClientSecret 
            : undefined,
        }),
      })
      
      if (response.ok) {
        alert('Settings saved successfully!')
        loadSettings()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleConnectAirtable = async () => {
    if (!airtableApiKey || !airtableBaseId) {
      alert('Please enter both API Key and Base ID')
      return
    }
    
    setSaving(true)
    try {
      const response = await fetch('/api/integrations/airtable/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: airtableApiKey,
          base_id: airtableBaseId,
          table_name: airtableTableName,
        }),
      })
      
      if (response.ok) {
        setIntegrations(prev => ({ 
          ...prev, 
          airtable: { connected: true, baseId: airtableBaseId } 
        }))
        alert('Airtable connected successfully!')
        loadSettings()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to connect Airtable')
      }
    } catch (error) {
      console.error('Failed to connect Airtable:', error)
      alert('Failed to connect Airtable')
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnectAirtable = async () => {
    if (!confirm('Are you sure you want to disconnect Airtable?')) {
      return
    }
    
    setDisconnecting(true)
    try {
      const response = await fetch('/api/integrations/airtable/disconnect', {
        method: 'POST',
      })
      if (response.ok) {
        setIntegrations(prev => ({ ...prev, airtable: { connected: false } }))
      } else {
        alert('Failed to disconnect Airtable')
      }
    } catch (error) {
      console.error('Failed to disconnect Airtable:', error)
    } finally {
      setDisconnecting(false)
    }
  }

  const isCompany = entityType === 'company'

  return (
    <div className="space-y-8 p-6">
      <div>
        <Heading>Settings</Heading>
        <Text>Manage your account and integrations</Text>
      </div>

      {/* Entity Type Indicator */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 p-4">
        <div className="flex items-center gap-3">
          {isCompany ? (
            <BuildingOfficeIcon className="h-6 w-6 text-blue-600" />
          ) : (
            <UserIcon className="h-6 w-6 text-green-600" />
          )}
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {isCompany ? 'Company Account' : 'Individual Account'}
            </p>
            {companyProfile && (
              <p className="text-sm text-gray-500">
                {companyProfile.company_name} ({companyProfile.company_type})
              </p>
            )}
          </div>
          {isCompany && (
            <Badge color="blue" className="ml-auto">Advanced Features</Badge>
          )}
        </div>
      </div>

      {/* Integrations Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Integrations
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Connect external services to export and share your transactions
          </p>
        </div>

        {/* Tabs for Company accounts */}
        {isCompany && (
          <div className="border-b border-gray-200 dark:border-zinc-700">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('google')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'google'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Google Sheets
              </button>
              <button
                onClick={() => setActiveTab('airtable')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'airtable'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Airtable
              </button>
            </nav>
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Google Sheets Integration */}
          {(!isCompany || activeTab === 'google') && (
            <div className="space-y-6">
              {/* Connection Status */}
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
                      Export your categorized transactions directly to Google Sheets.
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
                      {connecting ? 'Connecting...' : 'Connect Google Account'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Custom Credentials (Company only) */}
              {isCompany && (
                <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        Custom OAuth Credentials
                      </h4>
                      <p className="text-sm text-gray-500 mt-1">
                        Use your own Google Cloud project for more control
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useCustomCredentials}
                        onChange={(e) => setUseCustomCredentials(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {useCustomCredentials && (
                    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-zinc-700">
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <div className="flex gap-2">
                          <InformationCircleIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
                          <p className="text-sm text-blue-800 dark:text-blue-300">
                            Create credentials at{' '}
                            <a 
                              href="https://console.cloud.google.com/apis/credentials" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="underline"
                            >
                              Google Cloud Console
                            </a>
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Client ID
                        </label>
                        <input
                          type="text"
                          value={customClientId}
                          onChange={(e) => setCustomClientId(e.target.value)}
                          placeholder="xxxxx.apps.googleusercontent.com"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Client Secret
                        </label>
                        <div className="relative">
                          <input
                            type={showClientSecret ? 'text' : 'password'}
                            value={customClientSecret}
                            onChange={(e) => setCustomClientSecret(e.target.value)}
                            placeholder="Enter client secret"
                            className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => setShowClientSecret(!showClientSecret)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showClientSecret ? (
                              <EyeSlashIcon className="h-5 w-5" />
                            ) : (
                              <EyeIcon className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <Button
                        color="blue"
                        onClick={handleSaveGoogleSettings}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Save Credentials'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

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
          )}

          {/* Airtable Integration (Company only) */}
          {isCompany && activeTab === 'airtable' && (
            <div className="space-y-6">
              {/* Connection Status */}
              <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-white dark:bg-zinc-700 rounded-lg flex items-center justify-center shadow-sm">
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="18" height="18" rx="4" fill="#FCB400"/>
                      <rect x="6" y="6" width="5" height="5" rx="1" fill="#FFFFFF"/>
                      <rect x="13" y="6" width="5" height="5" rx="1" fill="#FFFFFF"/>
                      <rect x="6" y="13" width="5" height="5" rx="1" fill="#FFFFFF"/>
                      <rect x="13" y="13" width="5" height="5" rx="1" fill="#FFFFFF"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Airtable</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Sync your transactions to Airtable for collaborative editing with your team.
                    </p>
                    {loading ? (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
                        <span className="text-sm text-gray-500">Checking status...</span>
                      </div>
                    ) : integrations.airtable.connected ? (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <CheckCircleIcon className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600 dark:text-green-400">Connected</span>
                        </div>
                        {integrations.airtable.baseId && (
                          <p className="text-xs text-gray-500">
                            Base ID: {integrations.airtable.baseId}
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
              </div>

              {/* Airtable Configuration */}
              <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4 space-y-4">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <div className="flex gap-2">
                    <InformationCircleIcon className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      Get your API key from{' '}
                      <a 
                        href="https://airtable.com/create/tokens" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Airtable Settings
                      </a>
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    API Key / Personal Access Token
                  </label>
                  <div className="relative">
                    <input
                      type={showAirtableKey ? 'text' : 'password'}
                      value={airtableApiKey}
                      onChange={(e) => setAirtableApiKey(e.target.value)}
                      placeholder="pat..."
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAirtableKey(!showAirtableKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showAirtableKey ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Base ID
                  </label>
                  <input
                    type="text"
                    value={airtableBaseId}
                    onChange={(e) => setAirtableBaseId(e.target.value)}
                    placeholder="appXXXXXXXXXXXXXX"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Find this in your Airtable base URL: airtable.com/appXXXX/...
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Table Name
                  </label>
                  <input
                    type="text"
                    value={airtableTableName}
                    onChange={(e) => setAirtableTableName(e.target.value)}
                    placeholder="Transactions"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3">
                  {integrations.airtable.connected ? (
                    <>
                      <Button
                        color="blue"
                        onClick={handleConnectAirtable}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Update Settings'}
                      </Button>
                      <Button
                        color="red"
                        onClick={handleDisconnectAirtable}
                        disabled={disconnecting}
                      >
                        {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                      </Button>
                    </>
                  ) : (
                    <Button
                      color="blue"
                      onClick={handleConnectAirtable}
                      disabled={saving || !airtableApiKey || !airtableBaseId}
                    >
                      {saving ? 'Connecting...' : 'Connect Airtable'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <h4 className="font-medium text-amber-900 dark:text-amber-200 mb-2">
                  Why use Airtable?
                </h4>
                <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
                  <li>• Collaborative editing with your team and accountant</li>
                  <li>• Rich field types and custom views</li>
                  <li>• Built-in automations and integrations</li>
                  <li>• Mobile app for on-the-go access</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* More Settings Section */}
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
