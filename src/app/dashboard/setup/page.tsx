// @ts-nocheck
'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Heading, Text, Button } from '@/components/catalyst'
import { BuildingOfficeIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

// Simple setup page that avoids Headless UI Label context issues during SSR
// The full wizard components (CompanyDetailsForm, TaxSettingsForm, etc.) use Switch/Radio
// which cause prerender errors due to Label context requirements

export default function SetupWizardPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [formData, setFormData] = useState({
    companyName: '',
    companyType: 'sole_trader',
  })
  const [saving, setSaving] = useState(false)

  // Only render form after mount to avoid SSR issues
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.companyName.trim()) return

    setSaving(true)
    try {
      const response = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formData.companyName,
          companyType: formData.companyType,
          setupCompleted: true,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.details || data.error || 'Failed to create company')
      }

      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      console.error('Setup error:', error)
      const message = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to complete setup: ${message}`)
    } finally {
      setSaving(false)
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <BuildingOfficeIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <Text>Loading setup...</Text>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full mb-4">
            <BuildingOfficeIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <Heading level={1}>Welcome! Let&apos;s set up your account</Heading>
          <Text className="mt-2">
            Tell us about your business to get started
          </Text>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="space-y-6">
            {/* Company Name */}
            <div>
              <label htmlFor="companyName" className="block font-medium mb-2">
                Company / Trading Name <span className="text-red-500">*</span>
              </label>
              <input
                id="companyName"
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="e.g., Smith & Co Accounting"
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Company Type */}
            <div>
              <label htmlFor="companyType" className="block font-medium mb-2">
                Business Type
              </label>
              <select
                id="companyType"
                value={formData.companyType}
                onChange={(e) => setFormData({ ...formData, companyType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="sole_trader">Sole Trader</option>
                <option value="limited_company">Limited Company</option>
                <option value="partnership">Partnership</option>
                <option value="individual">Individual</option>
              </select>
              <Text className="mt-1 text-sm text-gray-500">
                {formData.companyType === 'sole_trader' && 'Self-employed individual trading under their own name'}
                {formData.companyType === 'limited_company' && 'Incorporated company registered with Companies House'}
                {formData.companyType === 'partnership' && 'Business owned and run by two or more people'}
                {formData.companyType === 'individual' && 'Personal finance tracking (not a business)'}
              </Text>
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-8">
            <Button
              type="submit"
              color="blue"
              className="w-full"
              disabled={!formData.companyName.trim() || saving}
            >
              {saving ? 'Setting up...' : 'Complete Setup'}
            </Button>
          </div>

          <Text className="mt-4 text-sm text-center text-gray-500">
            You can configure additional settings like VAT and bank accounts later in Settings.
          </Text>
        </form>
      </div>
    </div>
  )
}
