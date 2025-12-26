"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"

interface CompanyProfile {
  id: string
  company_name: string
}

export default function FinancialStatementsPage() {
  const [companyProfiles, setCompanyProfiles] = useState<CompanyProfile[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("")
  const [statementType, setStatementType] = useState<'profit-and-loss' | 'balance-sheet' | 'cash-flow' | 'trial-balance'>('profit-and-loss')
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [asOfDate, setAsOfDate] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [statementData, setStatementData] = useState<any>(null)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    loadCompanyProfiles()
    // Set default dates
    const today = new Date()
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1)
    setStartDate(firstDayOfYear.toISOString().split('T')[0])
    setEndDate(today.toISOString().split('T')[0])
    setAsOfDate(today.toISOString().split('T')[0])
  }, [])

  const loadCompanyProfiles = async () => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: companies } = await supabase
        .from("company_profiles")
        .select("id, company_name")
        .eq("user_id", user.id)
        .eq("setup_completed", true)

      setCompanyProfiles(companies || [])
      if (companies && companies.length > 0) {
        setSelectedCompanyId(companies[0].id)
      }
    } catch (error) {
      console.error("Error loading company profiles:", error)
    }
  }

  const generateStatement = async () => {
    if (!selectedCompanyId) {
      setError("Please select a company")
      return
    }

    setLoading(true)
    setError("")
    setStatementData(null)

    try {
      const url = `/api/exports/financial-statement/${statementType}`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyProfileId: selectedCompanyId,
          startDate,
          endDate,
          asOfDate,
          format: 'json',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate statement")
      }

      const data = await response.json()
      setStatementData(data)
    } catch (err: any) {
      setError(err.message || "Failed to generate statement")
    } finally {
      setLoading(false)
    }
  }

  const exportStatement = async (format: 'csv' | 'json') => {
    if (!selectedCompanyId) return

    try {
      const url = `/api/exports/financial-statement/${statementType}`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyProfileId: selectedCompanyId,
          startDate,
          endDate,
          asOfDate,
          format,
        }),
      })

      if (!response.ok) throw new Error("Export failed")

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${statementType}-${Date.now()}.${format === 'json' ? 'json' : 'csv'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)
    } catch (err) {
      alert("Failed to export statement")
    }
  }

  const exportToXero = async () => {
    if (!selectedCompanyId) return

    try {
      const response = await fetch('/api/exports/xero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyProfileId: selectedCompanyId,
          format: 'csv',
        }),
      })

      if (!response.ok) throw new Error("Export failed")

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `xero-export-${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)
    } catch (err) {
      alert("Failed to export to XERO")
    }
  }

  const exportToHMRC = async (type: 'vat' | 'self_assessment' | 'corporation_tax') => {
    if (!selectedCompanyId) return

    try {
      const response = await fetch('/api/exports/hmrc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          companyProfileId: selectedCompanyId,
          periodStart: startDate,
          periodEnd: endDate,
          format: 'csv',
        }),
      })

      if (!response.ok) throw new Error("Export failed")

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `hmrc-${type}-${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)
    } catch (err) {
      alert(`Failed to export ${type} to HMRC`)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Financial Statements</h1>

      {/* Controls */}
      <div className="bg-white border rounded-lg p-6 mb-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Company</label>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select a company</option>
              {companyProfiles.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.company_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Statement Type</label>
            <select
              value={statementType}
              onChange={(e) => setStatementType(e.target.value as any)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="profit-and-loss">Profit & Loss</option>
              <option value="balance-sheet">Balance Sheet</option>
              <option value="cash-flow">Cash Flow</option>
              <option value="trial-balance">Trial Balance</option>
            </select>
          </div>
        </div>

        {(statementType === 'profit-and-loss' || statementType === 'cash-flow') && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
        )}

        {(statementType === 'balance-sheet' || statementType === 'trial-balance') && (
          <div>
            <label className="block text-sm font-medium mb-1">As Of Date</label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={generateStatement}
            disabled={loading || !selectedCompanyId}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate Statement"}
          </button>
          {statementData && (
            <>
              <button
                onClick={() => exportStatement('csv')}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Export CSV
              </button>
              <button
                onClick={() => exportStatement('json')}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Export JSON
              </button>
            </>
          )}
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Export to Accounting Software</h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={exportToXero}
            disabled={!selectedCompanyId}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            Export to XERO
          </button>
          <button
            onClick={() => exportToHMRC('vat')}
            disabled={!selectedCompanyId}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            Export VAT Return (HMRC)
          </button>
          <button
            onClick={() => exportToHMRC('self_assessment')}
            disabled={!selectedCompanyId}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            Export Self-Assessment (HMRC)
          </button>
          <button
            onClick={() => exportToHMRC('corporation_tax')}
            disabled={!selectedCompanyId}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            Export Corporation Tax (HMRC)
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Statement Data */}
      {statementData && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Statement Results</h2>
          <pre className="bg-gray-50 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(statementData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

