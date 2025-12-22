'use client'

import { Heading, Text } from '@/components/catalyst'
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'

export default function ChatPage() {
  return (
    <div className="space-y-8">
      <div>
        <Heading>AI Assistant</Heading>
        <Text>Get help with your financial categorization</Text>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-6 mb-4">
          <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" />
        </div>
        <Heading level={2} className="mb-2">
          AI Assistant
        </Heading>
        <Text className="max-w-md">
          This feature is coming soon. You'll be able to chat with an AI
          assistant to help with transaction categorization and financial queries.
        </Text>
      </div>
    </div>
  )
}

