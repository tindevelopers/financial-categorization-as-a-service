'use client';

/**
 * AI Chat Page
 * 
 * Full-page chat interface for the FinCat AI Assistant
 */

import { Chat } from '@/components/chat';

export default function ChatPage() {
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Page Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            AI Assistant
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Get help with categorization, UK tax rules, and data management
          </p>
        </div>

        {/* Chat Interface */}
        <div className="flex-1 min-h-0 flex">
          {/* Sidebar - Chat History */}
          <aside className="hidden lg:flex w-64 flex-col border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            <ChatHistorySidebar />
          </aside>

          {/* Main Chat Area */}
          <main className="flex-1 flex flex-col bg-white dark:bg-gray-900">
            <Chat 
              className="flex-1"
              showHeader={false}
            />
          </main>
        </div>
      </div>
  );
}

/**
 * Chat History Sidebar Component
 */
function ChatHistorySidebar() {
  return (
    <div className="flex flex-col h-full">
      {/* New Chat Button */}
      <div className="p-4">
        <button
          className="w-full flex items-center justify-center gap-2 px-4 py-2
                     bg-blue-600 hover:bg-blue-700 text-white
                     rounded-lg font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Search chats..."
            className="w-full px-3 py-2 pl-9 text-sm
                       bg-white dark:bg-gray-800
                       border border-gray-200 dark:border-gray-700
                       rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-2">
        <div className="space-y-1">
          <ChatHistorySection title="Today">
            <ChatHistoryItem 
              title="Transaction categorization help"
              preview="How do I categorize office supplies?"
              active
            />
            <ChatHistoryItem 
              title="VAT questions"
              preview="What's the VAT threshold for 2024?"
            />
          </ChatHistorySection>
          
          <ChatHistorySection title="Yesterday">
            <ChatHistoryItem 
              title="Google Sheets sync"
              preview="Sync my transactions to sheets"
            />
          </ChatHistorySection>
          
          <ChatHistorySection title="Previous 7 Days">
            <ChatHistoryItem 
              title="Expense report help"
              preview="Generate a monthly expense report"
            />
            <ChatHistoryItem 
              title="HMRC categories"
              preview="What are allowable business expenses?"
            />
          </ChatHistorySection>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Powered by FinCat AI</span>
          <a href="#" className="hover:text-blue-600">Help</a>
        </div>
      </div>
    </div>
  );
}

interface ChatHistorySectionProps {
  title: string;
  children: React.ReactNode;
}

function ChatHistorySection({ title, children }: ChatHistorySectionProps) {
  return (
    <div className="py-2">
      <h3 className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {title}
      </h3>
      <div className="mt-1 space-y-0.5">
        {children}
      </div>
    </div>
  );
}

interface ChatHistoryItemProps {
  title: string;
  preview: string;
  active?: boolean;
}

function ChatHistoryItem({ title, preview, active = false }: ChatHistoryItemProps) {
  return (
    <button
      className={`w-full px-3 py-2 text-left rounded-lg transition-colors
        ${active 
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
    >
      <div className="font-medium text-sm truncate">{title}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
        {preview}
      </div>
    </button>
  );
}
