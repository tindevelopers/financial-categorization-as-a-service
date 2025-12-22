'use client'

import { Heading, Text } from '@/components/catalyst'
import { DocumentChartBarIcon } from '@heroicons/react/24/outline'

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <div>
        <Heading>Reports</Heading>
        <Text>View and generate financial reports</Text>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-6 mb-4">
          <DocumentChartBarIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" />
        </div>
        <Heading level={2} className="mb-2">
          Reports
        </Heading>
        <Text className="max-w-md">
          This feature is coming soon. You'll be able to generate various
          financial reports and analytics.
        </Text>
      </div>
    </div>
  )
}

