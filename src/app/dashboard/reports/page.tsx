'use client'

import { useState } from 'react'
import { Heading, Text, Button, Field, Label } from '@/components/catalyst'
import { 
  DocumentChartBarIcon, 
  ArrowDownTrayIcon,
  CalendarIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'

export default function ReportsPage() {
  const [reportType, setReportType] = useState('summary')
  const [format, setFormat] = useState('json')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [includeUnconfirmed, setIncludeUnconfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any>(null)

  async function generateReport() {
    setLoading(true)
    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          format,
          startDate,
          endDate,
          includeUnconfirmed,
        }),
      })

      if (format === 'csv') {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `report-${Date.now()}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        const data = await response.json()
        setReportData(data)
      }
    } catch (error) {
      console.error('Error generating report:', error)
      alert('Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  function downloadJSON() {
    if (!reportData) return
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Heading>Reports</Heading>
        <Text>Generate custom financial reports and export your data</Text>
      </div>

      {/* Report Generator */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <div className="flex items-center gap-3 mb-6">
          <DocumentChartBarIcon className="h-6 w-6 text-blue-600" />
          <Heading level={2}>Report Generator</Heading>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Report Type */}
          <Field>
            <Label>Report Type</Label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="summary">Summary Report</option>
              <option value="category">Category Breakdown</option>
              <option value="monthly">Monthly Report</option>
              <option value="transactions">Transaction List</option>
            </select>
          </Field>

          {/* Format */}
          <Field>
            <Label>Export Format</Label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
          </Field>

          {/* Start Date */}
          <Field>
            <Label>Start Date</Label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <CalendarIcon className="absolute right-3 top-3 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </Field>

          {/* End Date */}
          <Field>
            <Label>End Date</Label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <CalendarIcon className="absolute right-3 top-3 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </Field>
        </div>

        {/* Options */}
        <div className="mb-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeUnconfirmed}
              onChange={(e) => setIncludeUnconfirmed(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <Text>Include unconfirmed transactions</Text>
          </label>
        </div>

        {/* Generate Button */}
        <Button
          color="blue"
          onClick={generateReport}
          disabled={loading}
          className="w-full md:w-auto"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Generating...
            </>
          ) : (
            <>
              <DocumentChartBarIcon className="h-5 w-5 mr-2" />
              Generate Report
            </>
          )}
        </Button>
      </div>

      {/* Report Preview */}
      {reportData && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <Heading level={2}>Report Preview</Heading>
            <Button outline onClick={downloadJSON}>
              <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
              Download JSON
            </Button>
          </div>

          {/* Summary Stats */}
          {reportData.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Total Transactions
                </Text>
                <Heading level={3} className="text-2xl">
                  {reportData.summary.totalTransactions}
                </Heading>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Total Amount
                </Text>
                <Heading level={3} className="text-2xl">
                  £{parseFloat(reportData.summary.totalAmount).toLocaleString('en-GB', {
                    minimumFractionDigits: 2,
                  })}
                </Heading>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Categories
                </Text>
                <Heading level={3} className="text-2xl">
                  {reportData.summary.uniqueCategories}
                </Heading>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Confirmed
                </Text>
                <Heading level={3} className="text-2xl">
                  {reportData.summary.confirmedCount}
                </Heading>
              </div>
            </div>
          )}

          {/* Raw Data */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 overflow-auto max-h-96">
            <pre className="text-xs">
              {JSON.stringify(reportData, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Quick Reports */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <Heading level={2} className="mb-4">
          Quick Reports
        </Heading>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickReportCard
            title="This Month"
            description="Summary of current month"
            onClick={() => {
              const now = new Date()
              const start = new Date(now.getFullYear(), now.getMonth(), 1)
              setStartDate(start.toISOString().split('T')[0])
              setEndDate(now.toISOString().split('T')[0])
              setReportType('summary')
            }}
          />
          <QuickReportCard
            title="Last 30 Days"
            description="Rolling 30-day report"
            onClick={() => {
              const now = new Date()
              const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
              setStartDate(start.toISOString().split('T')[0])
              setEndDate(now.toISOString().split('T')[0])
              setReportType('summary')
            }}
          />
          <QuickReportCard
            title="Year to Date"
            description="Full year summary"
            onClick={() => {
              const now = new Date()
              const start = new Date(now.getFullYear(), 0, 1)
              setStartDate(start.toISOString().split('T')[0])
              setEndDate(now.toISOString().split('T')[0])
              setReportType('monthly')
            }}
          />
        </div>
      </div>
    </div>
  )
}

interface QuickReportCardProps {
  title: string
  description: string
  onClick: () => void
}

function QuickReportCard({ title, description, onClick }: QuickReportCardProps) {
  return (
    <button
      onClick={onClick}
      className="text-left p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <FunnelIcon className="h-5 w-5 text-blue-600" />
        <Heading level={3}>{title}</Heading>
      </div>
      <Text className="text-sm">{description}</Text>
    </button>
  )
}

