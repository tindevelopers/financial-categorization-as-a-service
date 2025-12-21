'use client'

import { Heading, Text } from '@/components/catalyst'
import { Cog6ToothIcon } from '@heroicons/react/24/outline'

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <Heading>Settings</Heading>
        <Text>Manage your account and preferences</Text>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-6 mb-4">
          <Cog6ToothIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" />
        </div>
        <Heading level={2} className="mb-2">
          Settings
        </Heading>
        <Text className="max-w-md">
          This feature is coming soon. You'll be able to manage your account
          settings, preferences, and integrations.
        </Text>
      </div>
    </div>
  )
}

