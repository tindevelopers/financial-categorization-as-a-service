'use client';

/**
 * Chat Input Component
 * 
 * Text input with send button and loading state
 */

import { FormEvent, KeyboardEvent, useRef, useEffect } from 'react';

interface ChatInputProps {
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: FormEvent) => void;
  isLoading?: boolean;
  onStop?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  isLoading = false,
  onStop,
  placeholder = 'Type a message...',
  disabled = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading && !disabled) {
        onSubmit(e as unknown as FormEvent);
      }
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading && !disabled) {
      onSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4"
    >
      <div className="flex items-end gap-2">
        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={onInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            rows={1}
            className="w-full resize-none rounded-xl border border-gray-300 dark:border-gray-600 
                       bg-gray-50 dark:bg-gray-800 px-4 py-3 pr-12
                       text-sm text-gray-900 dark:text-white
                       placeholder:text-gray-500 dark:placeholder:text-gray-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       disabled:opacity-50 disabled:cursor-not-allowed
                       max-h-[200px]"
          />
          
          {/* Character count for long messages */}
          {input.length > 500 && (
            <span className="absolute right-3 bottom-3 text-xs text-gray-400">
              {input.length}/2000
            </span>
          )}
        </div>

        {/* Send/Stop Button */}
        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            className="flex-shrink-0 p-3 rounded-xl bg-red-600 text-white
                       hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500
                       transition-colors"
            title="Stop generating"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <rect x="6" y="6" width="8" height="8" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() || disabled}
            className="flex-shrink-0 p-3 rounded-xl bg-blue-600 text-white
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600
                       transition-colors"
            title="Send message"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Hint text */}
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Press Enter to send, Shift+Enter for new line
      </p>
    </form>
  );
}

