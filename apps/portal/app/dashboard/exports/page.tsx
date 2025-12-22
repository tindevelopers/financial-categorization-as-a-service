'use client'

import { Heading, Text } from '@/components/catalyst'
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline'

export default function ExportsPage() {
  return (
    <div className="space-y-8">
      <div>
        <Heading>Exports</Heading>
        <Text>Export your data to various formats</Text>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-6 mb-4">
          <ArrowUpTrayIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" />
        </div>
        <Heading level={2} className="mb-2">
          Exports
        </Heading>
        <Text className="max-w-md">
          This feature is coming soon. You'll be able to export your categorized
          data to Excel, CSV, and accounting software formats.
        </Text>
      </div>
    </div>
  )
}

