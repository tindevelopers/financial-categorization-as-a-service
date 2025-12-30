'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  BuildingOffice2Icon, 
  PencilIcon, 
  EyeIcon, 
  EyeSlashIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  TrashIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'

interface EnterpriseTenant {
  id: string
  name: string
  domain?: string
  subscription_type: string
}

interface EnterpriseOAuthConfig {
  id: string
  tenant_id: string
  tenant_name: string
  tenant_domain?: string
  provider: string
  custom_client_id: string | null
  has_client_secret: boolean
  custom_redirect_uri?: string
  use_custom_credentials: boolean
  is_enabled: boolean
  dwd_subject_email?: string
  updated_at: string
}

export default function EnterpriseOAuthManagementPage() {
  const [enterpriseTenants, setEnterpriseTenants] = useState<EnterpriseTenant[]>([])
  const [oauthConfigs, setOauthConfigs] = useState<EnterpriseOAuthConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [testResults, setTestResults] = useState<Record<string, { valid: boolean; message: string }>>({})
  const [unauthorized, setUnauthorized] = useState(false)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<EnterpriseTenant | null>(null)
  const [formData, setFormData] = useState({
    custom_client_id: '',
    custom_client_secret: '',
    custom_redirect_uri: '',
    dwd_subject_email: '',
    use_custom_credentials: true,
    is_enabled: true,
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/enterprise-oauth', {
        credentials: 'include',
      })
      
      if (response.status === 403) {
        setUnauthorized(true)
        return
      }
      
      if (response.ok) {
        const data = await response.json()
        setEnterpriseTenants(data.tenants || [])
        setOauthConfigs(data.configs || [])
      } else {
        console.error('Failed to load enterprise OAuth data')
      }
    } catch (error) {
      console.error('Error loading enterprise OAuth data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleConfigureTenant = (tenant: EnterpriseTenant) => {
    setSelectedTenant(tenant)
    
    const existingConfig = oauthConfigs.find(c => c.tenant_id === tenant.id)
    if (existingConfig) {
      setFormData({
        custom_client_id: existingConfig.custom_client_id || '',
        custom_client_secret: existingConfig.has_client_secret ? '••••••••' : '',
        custom_redirect_uri: existingConfig.custom_redirect_uri || '',
        dwd_subject_email: existingConfig.dwd_subject_email || '',
        use_custom_credentials: existingConfig.use_custom_credentials,
        is_enabled: existingConfig.is_enabled,
      })
    } else {
      setFormData({
        custom_client_id: '',
        custom_client_secret: '',
        custom_redirect_uri: '',
        dwd_subject_email: '',
        use_custom_credentials: true,
        is_enabled: true,
      })
    }
    
    setIsModalOpen(true)
  }

  const handleSaveConfig = async () => {
    if (!selectedTenant) return
    
    if (!formData.custom_client_id.trim()) {
      alert('Client ID is required')
      return
    }
    
    const existingConfig = oauthConfigs.find(c => c.tenant_id === selectedTenant.id)
    const isUpdatingSecret = formData.custom_client_secret !== '••••••••' && formData.custom_client_secret.trim() !== ''
    
    if (!existingConfig && !formData.custom_client_secret.trim()) {
      alert('Client Secret is required for new configurations')
      return
    }
    
    setSaving(true)
    try {
      const payload: Record<string, any> = {
        tenant_id: selectedTenant.id,
        provider: 'google_sheets',
        custom_client_id: formData.custom_client_id.trim(),
        custom_redirect_uri: formData.custom_redirect_uri.trim() || null,
        dwd_subject_email: formData.dwd_subject_email.trim() || null,
        use_custom_credentials: formData.use_custom_credentials,
        is_enabled: formData.is_enabled,
      }
      
      if (isUpdatingSecret) {
        payload.custom_client_secret = formData.custom_client_secret.trim()
      }
      
      const response = await fetch('/api/admin/enterprise-oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      
      if (response.ok) {
        await loadData()
        setIsModalOpen(false)
        setSelectedTenant(null)
      } else {
        const error = await response.json()
        alert(`Failed to save: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error saving OAuth config:', error)
      alert('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfig = async (tenantId: string) => {
    if (!confirm('Are you sure you want to remove OAuth credentials for this tenant?')) {
      return
    }
    
    try {
      const response = await fetch(`/api/admin/enterprise-oauth?tenant_id=${tenantId}&provider=google_sheets`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (response.ok) {
        await loadData()
      } else {
        const error = await response.json()
        alert(`Failed to delete: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error deleting OAuth config:', error)
      alert('Failed to delete configuration')
    }
  }

  const getConfigForTenant = (tenantId: string) => {
    return oauthConfigs.find(c => c.tenant_id === tenantId)
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ShieldCheckIcon className="mx-auto h-16 w-16 text-red-400" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">Access Denied</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            This page is only accessible to Platform Administrators.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Enterprise OAuth Management
            </h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              Configure Google OAuth credentials for Enterprise tenants (BYO credentials)
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <div className="flex gap-3">
          <BuildingOffice2Icon className="h-5 w-5 flex-shrink-0 text-blue-500" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium">Enterprise BYO (Bring Your Own) Credentials</p>
            <p className="mt-1">
              Enterprise tenants can use their own Google Cloud project for OAuth. This allows them to:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Use their company branding on Google consent screens</li>
              <li>Store data in their own Google Workspace</li>
              <li>Maintain full control over API access and quotas</li>
              <li>Configure Domain-Wide Delegation for service account access</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500"></div>
        </div>
      )}

      {/* Enterprise Tenants List */}
      {!loading && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Enterprise Tenants ({enterpriseTenants.length})
          </h2>
          
          {enterpriseTenants.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-800">
              <BuildingOffice2Icon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-500 dark:text-gray-400">
                No enterprise tenants found. Enterprise tenants will appear here once created.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {enterpriseTenants.map((tenant) => {
                const config = getConfigForTenant(tenant.id)
                const testResult = testResults[tenant.id]
                
                return (
                  <div
                    key={tenant.id}
                    className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {tenant.name}
                        </h3>
                        {tenant.domain && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {tenant.domain}
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          config?.use_custom_credentials
                            ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {config?.use_custom_credentials ? 'BYO Configured' : 'Platform OAuth'}
                      </span>
                    </div>
                    
                    {config ? (
                      <div className="mb-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Client ID</span>
                          <span className="max-w-[200px] truncate font-mono text-xs text-gray-600 dark:text-gray-400">
                            {config.custom_client_id || 'Not set'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Client Secret</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                              {showSecrets[tenant.id] && config.has_client_secret
                                ? '[stored securely]'
                                : config.has_client_secret
                                ? '••••••••'
                                : 'Not set'}
                            </span>
                            {config.has_client_secret && (
                              <button
                                onClick={() =>
                                  setShowSecrets({ ...showSecrets, [tenant.id]: !showSecrets[tenant.id] })
                                }
                              >
                                {showSecrets[tenant.id] ? (
                                  <EyeSlashIcon className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <EyeIcon className="h-4 w-4 text-gray-400" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                        {config.dwd_subject_email && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">DWD Subject</span>
                            <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                              {config.dwd_subject_email}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Status</span>
                          <span
                            className={`text-xs font-medium ${
                              config.is_enabled ? 'text-green-600' : 'text-gray-500'
                            }`}
                          >
                            {config.is_enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        
                        {testResult && (
                          <div
                            className={`mt-2 flex items-center gap-2 rounded-lg p-2 text-xs ${
                              testResult.valid
                                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                            }`}
                          >
                            {testResult.valid ? (
                              <CheckCircleIcon className="h-4 w-4" />
                            ) : (
                              <ExclamationCircleIcon className="h-4 w-4" />
                            )}
                            {testResult.message}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                        <ExclamationCircleIcon className="mb-1 inline h-4 w-4" /> No custom OAuth
                        credentials configured. This tenant is using platform OAuth.
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleConfigureTenant(tenant)}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      >
                        <PencilIcon className="h-4 w-4" />
                        {config ? 'Edit' : 'Configure'}
                      </button>
                      {config && (
                        <button
                          onClick={() => handleDeleteConfig(tenant.id)}
                          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-gray-600 dark:bg-gray-700 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Configure OAuth Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
              Configure OAuth for {selectedTenant?.name}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Google OAuth Client ID *
                </label>
                <input
                  type="text"
                  value={formData.custom_client_id}
                  onChange={(e) => setFormData({ ...formData, custom_client_id: e.target.value })}
                  placeholder="xxxxx.apps.googleusercontent.com"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Google OAuth Client Secret {oauthConfigs.find(c => c.tenant_id === selectedTenant?.id) ? '(leave blank to keep existing)' : '*'}
                </label>
                <div className="relative mt-1">
                  <input
                    type={showSecrets['modal'] ? 'text' : 'password'}
                    value={formData.custom_client_secret}
                    onChange={(e) => setFormData({ ...formData, custom_client_secret: e.target.value })}
                    placeholder={formData.custom_client_secret === '••••••••' ? 'Existing secret (enter new to update)' : 'Enter client secret'}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets({ ...showSecrets, modal: !showSecrets['modal'] })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showSecrets['modal'] ? (
                      <EyeSlashIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Custom Redirect URI (optional)
                </label>
                <input
                  type="url"
                  value={formData.custom_redirect_uri}
                  onChange={(e) => setFormData({ ...formData, custom_redirect_uri: e.target.value })}
                  placeholder="https://yourdomain.com/api/integrations/google-sheets/callback"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Leave blank to use the platform default redirect URI
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Domain-Wide Delegation Subject Email *
                </label>
                <input
                  type="email"
                  value={formData.dwd_subject_email}
                  onChange={(e) => setFormData({ ...formData, dwd_subject_email: e.target.value })}
                  placeholder="admin@company.com"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Required for Enterprise BYO - The Google Workspace admin email for service account impersonation
                </p>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.use_custom_credentials}
                    onChange={(e) => setFormData({ ...formData, use_custom_credentials: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Use custom credentials</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_enabled}
                    onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Enabled</span>
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

