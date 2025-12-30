'use client'

import { useState, useCallback } from 'react'
import { Button, Text } from '@/components/catalyst'
import {
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  LinkIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

interface SheetSelectorProps {
  value: string | null
  sheetName: string | null
  onChange: (spreadsheetId: string | null, sheetName: string | null) => void
  placeholder?: string
  disabled?: boolean
}

interface ValidationResult {
  success: boolean
  spreadsheetId?: string
  title?: string
  url?: string
  error?: string
}

export function SheetSelector({
  value,
  sheetName,
  onChange,
  placeholder = "Paste Google Sheet URL or ID",
  disabled = false,
}: SheetSelectorProps) {
  const [inputValue, setInputValue] = useState('')
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)

  const validateSheet = useCallback(async (urlOrId: string) => {
    if (!urlOrId.trim()) {
      setValidationResult({ success: false, error: "Please enter a URL or ID" })
      return
    }

    setValidating(true)
    setValidationResult(null)

    try {
      const response = await fetch(
        `/api/integrations/google-sheets/validate?spreadsheetId=${encodeURIComponent(urlOrId)}`
      )
      const data = await response.json()

      if (data.success) {
        setValidationResult({
          success: true,
          spreadsheetId: data.spreadsheetId,
          title: data.title,
          url: data.url,
        })
        // Auto-apply on successful validation
        onChange(data.spreadsheetId, data.title)
        setInputValue('')
      } else {
        setValidationResult({
          success: false,
          error: data.error || "Could not access this spreadsheet",
        })
      }
    } catch (error: any) {
      setValidationResult({
        success: false,
        error: error.message || "Failed to validate spreadsheet",
      })
    } finally {
      setValidating(false)
    }
  }, [onChange])

  const handleUnlink = useCallback(() => {
    onChange(null, null)
    setValidationResult(null)
    setInputValue('')
  }, [onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      validateSheet(inputValue)
    }
  }, [inputValue, validateSheet])

  // If already linked, show the linked sheet
  if (value && sheetName) {
    return (
      <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <DocumentTextIcon className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <Text className="font-medium text-green-800 dark:text-green-200 truncate">
            {sheetName}
          </Text>
          <a
            href={`https://docs.google.com/spreadsheets/d/${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-600 dark:text-green-400 hover:underline"
          >
            Open in Google Sheets
          </a>
        </div>
        <Button
          plain
          onClick={handleUnlink}
          disabled={disabled}
          className="text-green-600 hover:text-green-800 dark:text-green-400"
        >
          <XMarkIcon className="h-5 w-5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || validating}
            className="w-full px-3 py-2 pr-10 border border-zinc-300 dark:border-zinc-600 rounded-md 
                       bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {inputValue && (
            <button
              type="button"
              onClick={() => setInputValue('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          onClick={() => validateSheet(inputValue)}
          disabled={disabled || validating || !inputValue.trim()}
          color="blue"
        >
          {validating ? (
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
          ) : (
            <LinkIcon className="h-4 w-4" />
          )}
          {validating ? 'Validating...' : 'Link'}
        </Button>
      </div>

      {validationResult && (
        <div className={`flex items-start gap-2 p-2 rounded-md ${
          validationResult.success 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
        }`}>
          {validationResult.success ? (
            <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
          ) : (
            <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0" />
          )}
          <Text className="text-sm">
            {validationResult.success 
              ? `Linked to "${validationResult.title}"`
              : validationResult.error
            }
          </Text>
        </div>
      )}

      <Text className="text-xs text-zinc-500">
        Paste a Google Sheet URL like https://docs.google.com/spreadsheets/d/...
      </Text>
    </div>
  )
}

