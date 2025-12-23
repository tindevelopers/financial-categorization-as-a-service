'use client';

/**
 * Main Chat Component
 * 
 * Full-featured chat interface with streaming support, tool results, and suggested actions
 */

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef, useCallback } from 'react';
import { useChatContext, useChatContextData } from '@/context/ChatContext';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { SuggestedActions } from './SuggestedActions';
import { ChatHeader } from './ChatHeader';
import { getSuggestedActions, ChatContext } from '@/lib/ai/prompts';

interface ChatProps {
  className?: string;
  showHeader?: boolean;
  showSidebar?: boolean;
  embedded?: boolean;
}

export function Chat({ 
  className = '', 
  showHeader = true,
  embedded = false,
}: ChatProps) {
  const context = useChatContextData();
  const { sessionId, setSessionId, logAction } = useChatContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading: chatIsLoading,
    stop,
    reload,
    error,
    setMessages,
  } = useChat({
    api: '/api/chat',
    id: sessionId || undefined,
    body: {
      sessionId,
      context,
    },
    onResponse: (response: Response) => {
      // Get session ID from response headers
      const newSessionId = response.headers.get('X-Chat-Session-Id');
      if (newSessionId && newSessionId !== sessionId) {
        setSessionId(newSessionId);
      }
    },
    onFinish: () => {
      logAction('chat_message_received');
    },
    onError: (error: Error) => {
      console.error('Chat error:', error);
      logAction('chat_error', { error: error.message });
    },
  });

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle suggested action click
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInput(suggestion);
    // Auto-submit after a short delay
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      handleSubmit(fakeEvent);
    }, 100);
  }, [setInput, handleSubmit]);

  // Clear chat
  const handleClearChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    logAction('chat_cleared');
  }, [setMessages, setSessionId, logAction]);

  // Get suggested actions based on context
  const suggestions = getSuggestedActions(context);

  const isLoading = chatIsLoading;

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      {showHeader && (
        <ChatHeader
          onClear={handleClearChat}
          hasMessages={messages.length > 0}
          embedded={embedded}
        />
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-4 mb-4">
              <svg
                className="w-8 h-8 text-blue-600 dark:text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              FinCat AI Assistant
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm mb-6">
              Ask me about your transactions, UK tax rules, expense categories, 
              or get help with Google Sheets sync.
            </p>

            {/* Suggested Actions */}
            <SuggestedActions
              suggestions={suggestions}
              onSelect={handleSuggestionClick}
            />
          </div>
        ) : (
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            onRetry={reload}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">
            {error.message || 'An error occurred. Please try again.'}
          </p>
          <button
            onClick={() => reload()}
            className="text-sm text-red-700 dark:text-red-300 underline mt-1"
          >
            Retry
          </button>
        </div>
      )}

      {/* Input Area */}
      <ChatInput
        input={input}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        onStop={stop}
        placeholder={
          messages.length === 0
            ? "Ask about transactions, tax rules, or sync with sheets..."
            : "Type a message..."
        }
      />
    </div>
  );
}

