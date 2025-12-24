'use client'

import { useState, useEffect } from 'react'
import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
  DropdownLabel,
  DropdownDivider,
} from '@/components/catalyst'
import {
  ChevronDownIcon,
  BuildingOfficeIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline'

interface Company {
  id: string
  company_name: string
  company_type: string
  vat_registered: boolean
}

export function CompanySwitcher() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    try {
      const response = await fetch('/api/company')
      if (response.ok) {
        const data = await response.json()
        setCompanies(data.companies || [])
        if (data.companies && data.companies.length > 0) {
          // Set the first company as current (in future, get from localStorage or user preference)
          setCurrentCompany(data.companies[0])
        }
      }
    } catch (error) {
      console.error('Failed to load companies:', error)
    } finally {
      setLoading(false)
    }
  }

  const switchCompany = (company: Company) => {
    setCurrentCompany(company)
    // In future, store preference in localStorage or user settings
    localStorage.setItem('activeCompanyId', company.id)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="h-8 w-8 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  if (companies.length === 0) {
    return (
      <a
        href="/dashboard/setup"
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
      >
        <PlusCircleIcon className="h-5 w-5" />
        <span>Setup Company</span>
      </a>
    )
  }

  return (
    <Dropdown>
      <DropdownButton outline>
        <div className="flex items-center gap-2">
          <BuildingOfficeIcon className="h-5 w-5" />
          <span className="truncate max-w-[200px]">
            {currentCompany?.company_name || 'Select Company'}
          </span>
          <ChevronDownIcon className="h-4 w-4" />
        </div>
      </DropdownButton>

      <DropdownMenu>
        <DropdownLabel>Your Companies</DropdownLabel>
        {companies.map((company) => (
          <DropdownItem
            key={company.id}
            onClick={() => switchCompany(company)}
          >
            <div>
              <div className="font-medium">{company.company_name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {company.company_type.replace('_', ' ')}
                {company.vat_registered && ' • VAT Registered'}
              </div>
            </div>
          </DropdownItem>
        ))}

        <DropdownDivider />

        <DropdownItem href="/dashboard/setup">
          <PlusCircleIcon className="h-4 w-4" />
          Add Company
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  )
}

