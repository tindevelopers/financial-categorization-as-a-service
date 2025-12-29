'use client'

import { useState, useEffect } from 'react'
import { Button, Text } from '@/components/catalyst'
import {
  FolderIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'

interface SharedDrive {
  id: string
  name: string
  createdTime?: string
}

interface GoogleDriveSettingsProps {
  companyId: string
  initialDriveId?: string | null
  initialDriveName?: string | null
  initialSpreadsheetId?: string | null
  initialSpreadsheetName?: string | null
  onChange: (settings: {
    googleSharedDriveId: string | null
    googleSharedDriveName: string | null
    googleMasterSpreadsheetId: string | null
    googleMasterSpreadsheetName: string | null
  }) => void
}

export function GoogleDriveSettings({
  companyId,
  initialDriveId,
  initialDriveName,
  initialSpreadsheetId,
  initialSpreadsheetName,
  onChange,
}: GoogleDriveSettingsProps) {
  const [drives, setDrives] = useState<SharedDrive[]>([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [serviceAccountEmail, setServiceAccountEmail] = useState<string | null>(null)
  
  const [selectedDriveId, setSelectedDriveId] = useState<string>(initialDriveId || '')
  const [selectedDriveName, setSelectedDriveName] = useState<string>(initialDriveName || '')
  const [manualDriveId, setManualDriveId] = useState<string>('')
  const [useManualEntry, setUseManualEntry] = useState(false)
  const [spreadsheetId, setSpreadsheetId] = useState<string>(initialSpreadsheetId || '')
  const [spreadsheetName, setSpreadsheetName] = useState<string>(initialSpreadsheetName || '')

  // Load available shared drives
  useEffect(() => {
    async function loadDrives() {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch('/api/integrations/google-sheets/shared-drives')
        const data = await response.json()
        
        if (data.error && !data.drives) {
          setError(data.error)
        } else {
          setDrives(data.drives || [])
          setServiceAccountEmail(data.serviceAccountEmail || null)
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load shared drives')
      } finally {
        setLoading(false)
      }
    }
    
    loadDrives()
  }, [])

  // Notify parent of changes
  useEffect(() => {
    const driveId = useManualEntry ? manualDriveId : selectedDriveId
    const driveName = useManualEntry ? 'Manual Entry' : selectedDriveName
    
    onChange({
      googleSharedDriveId: driveId || null,
      googleSharedDriveName: driveName || null,
      googleMasterSpreadsheetId: spreadsheetId || null,
      googleMasterSpreadsheetName: spreadsheetName || null,
    })
  }, [selectedDriveId, selectedDriveName, manualDriveId, useManualEntry, spreadsheetId, spreadsheetName, onChange])

  const handleDriveSelect = (driveId: string) => {
    const drive = drives.find(d => d.id === driveId)
    setSelectedDriveId(driveId)
    setSelectedDriveName(drive?.name || '')
    setUseManualEntry(false)
    setTestResult(null)
  }

  const handleTestConnection = async () => {
    const driveId = useManualEntry ? manualDriveId : selectedDriveId
    
    if (!driveId) {
      setTestResult({ success: false, message: 'Please select or enter a Shared Drive ID' })
      return
    }

    try {
      setTesting(true)
      setTestResult(null)

      // Test by trying to list files in the drive
      const response = await fetch(`/api/integrations/google-sheets/shared-drives/test?driveId=${encodeURIComponent(driveId)}`)
      const data = await response.json()

      if (data.success) {
        setTestResult({ 
          success: true, 
          message: `Successfully connected to "${data.driveName}". The service account has access.`
        })
      } else {
        setTestResult({ 
          success: false, 
          message: data.error || 'Could not access the shared drive'
        })
      }
    } catch (err: any) {
      setTestResult({ 
        success: false, 
        message: err.message || 'Failed to test connection'
      })
    } finally {
      setTesting(false)
    }
  }

  const handleRefresh = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/integrations/google-sheets/shared-drives')
      const data = await response.json()
      
      if (data.error && !data.drives) {
        setError(data.error)
      } else {
        setDrives(data.drives || [])
        setServiceAccountEmail(data.serviceAccountEmail || null)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to refresh')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          <FolderIcon className="h-5 w-5 text-blue-500" />
          Google Shared Drive Settings
        </h3>
        <Text className="mt-1">
          Configure a Shared Drive for company-level exports. All bank statement exports will be stored here,
          accessible to your team and external accountants.
        </Text>
      </div>

      {serviceAccountEmail && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <Text className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Service Account:</strong> {serviceAccountEmail}
          </Text>
          <Text className="text-xs text-blue-600 dark:text-blue-300 mt-1">
            Add this email as a Manager to your Shared Drive to enable access.
          </Text>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <ExclamationCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <Text className="text-sm text-red-800 dark:text-red-200">{error}</Text>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Select Shared Drive
          </label>
          <Button 
            onClick={handleRefresh} 
            disabled={loading}
            plain
            className="text-sm"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-zinc-500">
            <ArrowPathIcon className="h-5 w-5 animate-spin" />
            <span>Loading shared drives...</span>
          </div>
        ) : drives.length > 0 ? (
          <div className="space-y-2">
            {drives.map((drive) => (
              <label
                key={drive.id}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedDriveId === drive.id && !useManualEntry
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                <input
                  type="radio"
                  name="sharedDrive"
                  value={drive.id}
                  checked={selectedDriveId === drive.id && !useManualEntry}
                  onChange={() => handleDriveSelect(drive.id)}
                  className="h-4 w-4 text-blue-600"
                />
                <FolderIcon className="h-5 w-5 text-yellow-500" />
                <div className="flex-1">
                  <Text className="font-medium">{drive.name}</Text>
                  <Text className="text-xs text-zinc-500">{drive.id}</Text>
                </div>
                {selectedDriveId === drive.id && !useManualEntry && (
                  <CheckCircleIcon className="h-5 w-5 text-blue-500" />
                )}
              </label>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 border border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg">
            <FolderIcon className="h-8 w-8 text-zinc-400 mx-auto mb-2" />
            <Text className="text-zinc-500">No shared drives found</Text>
            <Text className="text-xs text-zinc-400 mt-1">
              Create a Shared Drive and add the service account as a Manager
            </Text>
          </div>
        )}

        {/* Manual entry option */}
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useManualEntry}
              onChange={(e) => {
                setUseManualEntry(e.target.checked)
                if (e.target.checked) {
                  setSelectedDriveId('')
                  setSelectedDriveName('')
                }
              }}
              className="h-4 w-4 text-blue-600 rounded"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              Enter Shared Drive ID manually
            </span>
          </label>

          {useManualEntry && (
            <input
              type="text"
              value={manualDriveId}
              onChange={(e) => setManualDriveId(e.target.value)}
              placeholder="e.g., 0AGZ_O6Qw1KL2Uk9PVA"
              className="mt-2 w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md 
                         bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          )}
        </div>

        {/* Test connection button */}
        <div className="flex items-center gap-4">
          <Button
            onClick={handleTestConnection}
            disabled={testing || (!selectedDriveId && !manualDriveId)}
            color="blue"
          >
            {testing ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </Button>

          {testResult && (
            <div className={`flex items-center gap-2 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.success ? (
                <CheckCircleIcon className="h-5 w-5" />
              ) : (
                <ExclamationCircleIcon className="h-5 w-5" />
              )}
              <span className="text-sm">{testResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Master Spreadsheet section */}
      {(selectedDriveId || manualDriveId) && (
        <div className="pt-6 border-t border-zinc-200 dark:border-zinc-700 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-zinc-900 dark:text-white flex items-center gap-2">
              <DocumentTextIcon className="h-4 w-4 text-green-500" />
              Master Spreadsheet (Optional)
            </h4>
            <Text className="text-xs text-zinc-500 mt-1">
              If you already have a master spreadsheet, enter its ID. Otherwise, one will be created on first export.
            </Text>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Spreadsheet ID
              </label>
              <input
                type="text"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                placeholder="Leave empty to auto-create"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md 
                           bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Spreadsheet Name
              </label>
              <input
                type="text"
                value={spreadsheetName}
                onChange={(e) => setSpreadsheetName(e.target.value)}
                placeholder={`FinCat Bank Statements ${new Date().getFullYear()}`}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md 
                           bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

