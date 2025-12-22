'use client'

import { useState, useEffect } from 'react'
import { Heading, Text, Button, Badge } from '@/components/catalyst'
import {
  ArrowUpTrayIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  ChartBarIcon,
  CurrencyPoundIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'

interface AnalyticsSummary {
  totalJobs: number
  completedJobs: number
  processingJobs: number
  failedJobs: number
  totalTransactions: number
  confirmedTransactions: number
  unconfirmedTransactions: number
  totalAmount: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<AnalyticsSummary>({
    totalJobs: 0,
    completedJobs: 0,
    processingJobs: 0,
    failedJobs: 0,
    totalTransactions: 0,
    confirmedTransactions: 0,
    unconfirmedTransactions: 0,
    totalAmount: '0.00',
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard/page.tsx:fetchDashboardData',message:'Fetching dashboard data',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    try {
      const response = await fetch('/api/analytics/summary')
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard/page.tsx:response',message:'Dashboard API response',data:{status:response.status,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      if (!response.ok) throw new Error('Failed to fetch analytics')
      
      const data = await response.json()
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard/page.tsx:data',message:'Dashboard data received',data:{summary:data.summary},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      setStats(data.summary)
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/0c1b14f8-8590-4e1a-a5b8-7e9645e1d13e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard/page.tsx:error',message:'Dashboard fetch error',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Heading>Dashboard</Heading>
        <Text>Welcome back! Here&apos;s your overview for today.</Text>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Jobs"
          value={loading ? '...' : stats.totalJobs}
          subtitle={`${stats.completedJobs} completed`}
          icon={<DocumentTextIcon className="h-6 w-6" />}
          color="blue"
        />
        <MetricCard
          title="Transactions"
          value={loading ? '...' : stats.totalTransactions}
          subtitle="Processed"
          icon={<ChartBarIcon className="h-6 w-6" />}
          color="green"
        />
        <MetricCard
          title="Confirmed"
          value={loading ? '...' : stats.confirmedTransactions}
          subtitle="Ready to export"
          icon={<CheckCircleIcon className="h-6 w-6" />}
          color="emerald"
        />
        <MetricCard
          title="Needs Review"
          value={loading ? '...' : stats.unconfirmedTransactions}
          subtitle="Pending confirmation"
          icon={<ClockIcon className="h-6 w-6" />}
          color="amber"
          badge={stats.unconfirmedTransactions > 0}
        />
      </div>

      {/* Total Amount Card */}
      {!loading && parseFloat(stats.totalAmount) > 0 && (
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-blue-100 mb-2">Total Amount Processed</Text>
              <div className="flex items-baseline gap-2">
                <CurrencyPoundIcon className="h-8 w-8" />
                <Heading level={1} className="text-4xl font-bold text-white">
                  {parseFloat(stats.totalAmount).toLocaleString('en-GB', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Heading>
              </div>
            </div>
            <Link href="/dashboard/analytics">
              <Button className="bg-white text-blue-600 hover:bg-blue-50">
                View Analytics
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <Heading level={2} className="mb-4">
          Quick Actions
        </Heading>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickActionCard
            title="Upload Bank Statement"
            description="Import transactions from your bank CSV"
            href="/dashboard/uploads/bank-statements"
            icon={<ArrowUpTrayIcon className="h-8 w-8" />}
            color="blue"
          />

          <QuickActionCard
            title="Upload Receipts"
            description="Upload invoices and receipts for matching"
            href="/dashboard/uploads/receipts"
            icon={<DocumentTextIcon className="h-8 w-8" />}
            color="green"
          />

          <QuickActionCard
            title="Reconcile Transactions"
            description="Match bank transactions with receipts"
            href="/dashboard/reconciliation"
            icon={<CheckCircleIcon className="h-8 w-8" />}
            color="purple"
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <Heading level={2}>Quick Stats</Heading>
          <Link href="/dashboard/analytics">
            <Button outline>View All Analytics</Button>
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-pulse">
              <div className="text-gray-400 dark:text-gray-500 mb-4">
                <ChartBarIcon className="h-12 w-12 mx-auto" />
              </div>
              <Text>Loading analytics...</Text>
            </div>
          </div>
        ) : stats.totalTransactions === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-500 mb-4">
              <DocumentTextIcon className="h-12 w-12 mx-auto" />
            </div>
            <Text className="mb-4">No transactions yet</Text>
            <Link href="/dashboard/uploads/bank-statements">
              <Button color="blue">Upload Your First Statement</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Completion Rate
              </Text>
              <Heading level={2} className="text-2xl">
                {stats.totalJobs > 0
                  ? Math.round((stats.completedJobs / stats.totalJobs) * 100)
                  : 0}
                %
              </Heading>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Confirmation Rate
              </Text>
              <Heading level={2} className="text-2xl">
                {stats.totalTransactions > 0
                  ? Math.round((stats.confirmedTransactions / stats.totalTransactions) * 100)
                  : 0}
                %
              </Heading>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Avg per Job
              </Text>
              <Heading level={2} className="text-2xl">
                {stats.completedJobs > 0
                  ? Math.round(stats.totalTransactions / stats.completedJobs)
                  : 0}
              </Heading>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Metric Card Component
interface MetricCardProps {
  title: string
  value: number | string
  subtitle: string
  icon: React.ReactNode
  color: string
  badge?: boolean
}

function MetricCard({ title, value, subtitle, icon, color, badge }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
          {icon}
        </div>
        {badge && (
          <Badge color="amber">Review</Badge>
        )}
      </div>

      <div>
        <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </Text>
        <div className="mt-2 flex items-baseline gap-2">
          <Heading level={1} className="text-3xl font-bold">
            {value}
          </Heading>
        </div>
        <Text className="mt-1 text-sm">
          {subtitle}
        </Text>
      </div>
    </div>
  )
}

// Quick Action Card Component
interface QuickActionCardProps {
  title: string
  description: string
  href: string
  icon: React.ReactNode
  color: string
}

function QuickActionCard({ title, description, href, icon, color }: QuickActionCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    purple: 'text-purple-600 dark:text-purple-400',
  }

  return (
    <Link
      href={href}
      className="block p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
    >
      <div className={`mb-4 ${colorClasses[color as keyof typeof colorClasses]}`}>
        {icon}
      </div>
      <Heading level={3} className="mb-2">
        {title}
      </Heading>
      <Text className="text-sm">
        {description}
      </Text>
    </Link>
  )
}

