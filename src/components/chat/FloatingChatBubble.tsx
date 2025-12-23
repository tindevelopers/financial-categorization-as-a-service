'use client';

/**
 * Floating Chat Bubble Component
 * 
 * A floating button that expands into a chat interface
 */

import { useState, useEffect } from 'react';
import { useChatContext } from '@/context/ChatContext';
import { Chat } from './Chat';

interface FloatingChatBubbleProps {
  position?: 'bottom-right' | 'bottom-left';
}

export function FloatingChatBubble({ position = 'bottom-right' }: FloatingChatBubbleProps) {
  const { isOpen, setIsOpen, toggleChat } = useChatContext();
  const [isAnimating, setIsAnimating] = useState(false);

  // Handle animation state
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    } else {
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const positionClasses = position === 'bottom-right' 
    ? 'right-6 bottom-6' 
    : 'left-6 bottom-6';

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Chat Container */}
      <div
        className={`fixed ${positionClasses} z-50 transition-all duration-300 ease-in-out
          ${isOpen || isAnimating ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        {/* Expanded Chat Window */}
        <div
          className={`absolute bottom-16 ${position === 'bottom-right' ? 'right-0' : 'left-0'}
            w-[380px] h-[600px] max-h-[calc(100vh-120px)]
            bg-white dark:bg-gray-900
            rounded-2xl shadow-2xl
            border border-gray-200 dark:border-gray-700
            overflow-hidden
            transition-all duration-300 ease-in-out
            transform origin-bottom-right
            ${isOpen 
              ? 'opacity-100 scale-100 translate-y-0' 
              : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
            }
            max-sm:fixed max-sm:inset-4 max-sm:w-auto max-sm:h-auto max-sm:bottom-20
          `}
        >
          <Chat 
            showHeader={true}
            embedded={true}
            className="h-full"
          />
          
          {/* Close button for embedded mode */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-3 right-3 p-2 text-gray-500 hover:text-gray-700 
                       dark:text-gray-400 dark:hover:text-gray-200
                       hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Close chat"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Floating Button */}
        <button
          onClick={toggleChat}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center
            transition-all duration-300 ease-in-out pointer-events-auto
            focus:outline-none focus:ring-4 focus:ring-blue-500/30
            ${isOpen 
              ? 'bg-gray-700 hover:bg-gray-800 rotate-0' 
              : 'bg-blue-600 hover:bg-blue-700 hover:scale-110'
            }`}
          title={isOpen ? 'Close chat' : 'Open AI Assistant'}
        >
          {isOpen ? (
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          )}
          
          {/* Notification dot */}
          {!isOpen && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse" />
          )}
        </button>
      </div>
    </>
  );
}

