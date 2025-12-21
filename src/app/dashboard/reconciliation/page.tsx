'use client'

import { Heading, Text } from '@/components/catalyst'
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline'

export default function ReconciliationPage() {
  return (
    <div className="space-y-8">
      <div>
        <Heading>Reconciliation</Heading>
        <Text>Match bank transactions with receipts and invoices</Text>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-6 mb-4">
          <ArrowsRightLeftIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" />
        </div>
        <Heading level={2} className="mb-2">
          Reconciliation
        </Heading>
        <Text className="max-w-md">
          This feature is coming soon. You'll be able to match your bank
          transactions with uploaded receipts and invoices.
        </Text>
      </div>
    </div>
  )
}

