'use client'

import { useState, useEffect } from 'react'
import { Heading, Text, Button, Field, Label, Input } from '@/components/catalyst'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'

interface Transaction {
  id: string
  description: string
  amount: string
  category: string
  subcategory: string
  transaction_date: string
  confirmed: boolean
  notes: string
}

interface Filters {
  searchQuery: string
  category: string
  startDate: string
  endDate: string
  minAmount: string
  maxAmount: string
  confirmed: string
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  
  const [filters, setFilters] = useState<Filters>({
    searchQuery: '',
    category: '',
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
    confirmed: '',
  })

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })

  useEffect(() => {
    searchTransactions()
  }, [pagination.page])

  async function searchTransactions() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (filters.searchQuery) params.append('q', filters.searchQuery)
      if (filters.category) params.append('category', filters.category)
      if (filters.startDate) params.append('start_date', filters.startDate)
      if (filters.endDate) params.append('end_date', filters.endDate)
      if (filters.minAmount) params.append('min_amount', filters.minAmount)
      if (filters.maxAmount) params.append('max_amount', filters.maxAmount)
      if (filters.confirmed) params.append('confirmed', filters.confirmed)

      const response = await fetch(`/api/transactions/search?${params}`)
      if (!response.ok) throw new Error('Failed to search transactions')

      const data = await response.json()
      setTransactions(data.transactions)
      setPagination(prev => ({ ...prev, ...data.pagination }))
      setCategories(data.filters.categories)
    } catch (error) {
      console.error('Error searching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
    searchTransactions()
  }

  function clearFilters() {
    setFilters({
      searchQuery: '',
      category: '',
      startDate: '',
      endDate: '',
      minAmount: '',
      maxAmount: '',
      confirmed: '',
    })
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const activeFiltersCount = Object.values(filters).filter(v => v !== '').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Heading>Transactions</Heading>
        <Text>Search and filter your transactions</Text>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={filters.searchQuery}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <Button type="submit" color="blue">
            <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
            Search
          </Button>
          
          <Button
            type="button"
            outline
            onClick={() => setShowFilters(!showFilters)}
          >
            <FunnelIcon className="h-5 w-5 mr-2" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="ml-2 bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Category Filter */}
              <Field>
                <Label>Category</Label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </Field>

              {/* Start Date */}
              <Field>
                <Label>Start Date</Label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </Field>

              {/* End Date */}
              <Field>
                <Label>End Date</Label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </Field>

              {/* Min Amount */}
              <Field>
                <Label>Min Amount (£)</Label>
                <input
                  type="number"
                  step="0.01"
                  value={filters.minAmount}
                  onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </Field>

              {/* Max Amount */}
              <Field>
                <Label>Max Amount (£)</Label>
                <input
                  type="number"
                  step="0.01"
                  value={filters.maxAmount}
                  onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </Field>

              {/* Confirmed Status */}
              <Field>
                <Label>Status</Label>
                <select
                  value={filters.confirmed}
                  onChange={(e) => setFilters({ ...filters, confirmed: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">All</option>
                  <option value="true">Confirmed</option>
                  <option value="false">Unconfirmed</option>
                </select>
              </Field>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button outline onClick={clearFilters}>
                <XMarkIcon className="h-5 w-5 mr-2" />
                Clear Filters
              </Button>
              <Button color="blue" onClick={handleSearch}>
                Apply Filters
              </Button>
            </div>
          </div>
        )}
      </form>

      {/* Results */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-pulse">
              <Text>Loading transactions...</Text>
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <Text>No transactions found</Text>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {new Date(transaction.transaction_date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div>{transaction.description}</div>
                        {transaction.notes && (
                          <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                            {transaction.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div>{transaction.category}</div>
                        {transaction.subcategory && (
                          <div className="text-gray-500 dark:text-gray-400 text-xs">
                            {transaction.subcategory}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                        £{parseFloat(transaction.amount).toLocaleString('en-GB', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {transaction.confirmed ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Confirmed
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <Text className="text-sm">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} results
                </Text>
                
                <div className="flex gap-2">
                  <Button
                    outline
                    disabled={pagination.page === 1}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </Button>
                  
                  <div className="flex items-center gap-2 px-4">
                    <Text className="text-sm">
                      Page {pagination.page} of {pagination.totalPages}
                    </Text>
                  </div>
                  
                  <Button
                    outline
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

