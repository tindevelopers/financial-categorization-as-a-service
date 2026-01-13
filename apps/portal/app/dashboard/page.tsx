'use client'

import { useState, useEffect } from 'react'
import { Heading, Text, Button, Badge } from '@/components/catalyst'
import {
  ArrowUpTrayIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalUploads: 0,
    totalTransactions: 0,
    matchedTransactions: 0,
    unmatchedTransactions: 0,
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Heading>Dashboard</Heading>
        <Text>Welcome back! Here's your overview for today.</Text>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Uploads"
          value={stats.totalUploads}
          subtitle="This month"
          icon={<DocumentTextIcon className="h-6 w-6" />}
          color="blue"
        />
        <MetricCard
          title="Transactions"
          value={stats.totalTransactions}
          subtitle="Processed"
          icon={<CheckCircleIcon className="h-6 w-6" />}
          color="green"
        />
        <MetricCard
          title="Matched"
          value={stats.matchedTransactions}
          subtitle="Reconciled"
          icon={<CheckCircleIcon className="h-6 w-6" />}
          color="emerald"
        />
        <MetricCard
          title="Unmatched"
          value={stats.unmatchedTransactions}
          subtitle="Needs review"
          icon={<ClockIcon className="h-6 w-6" />}
          color="amber"
          badge={stats.unmatchedTransactions > 0}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <Heading level={2} className="mb-4">
          Quick Actions
        </Heading>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickActionCard
            title="Upload Statement"
            description="Import transactions from bank, credit card, or processor statements"
            href="/dashboard/statements"
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

      {/* Recent Activity - Placeholder */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <Heading level={2} className="mb-4">
          Recent Activity
        </Heading>

        <div className="text-center py-12">
          <div className="text-gray-400 dark:text-gray-500 mb-4">
            <DocumentTextIcon className="h-12 w-12 mx-auto" />
          </div>
          <Text className="mb-4">No recent activity</Text>
          <Link href="/dashboard/statements">
            <Button color="blue">Upload Your First Statement</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

// Metric Card Component
interface MetricCardProps {
  title: string
  value: number
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

