'use client';

/**
 * Chat Header Component
 * 
 * Header with title and action buttons
 */

interface ChatHeaderProps {
  onClear?: () => void;
  hasMessages?: boolean;
  embedded?: boolean;
  onClose?: () => void;
}

export function ChatHeader({
  onClear,
  hasMessages = false,
  embedded = false,
  onClose,
}: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="flex items-center gap-3">
        {/* AI Icon */}
        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-blue-600 dark:text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.25 2.25M5 14.5l2.25 2.25"
            />
          </svg>
        </div>
        
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">
            FinCat AI
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Your financial assistant
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Clear Chat Button */}
        {hasMessages && onClear && (
          <button
            onClick={onClear}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                       hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Clear chat"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}

        {/* Close Button (for embedded/floating mode) */}
        {embedded && onClose && (
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                       hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

