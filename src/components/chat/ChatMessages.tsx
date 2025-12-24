'use client';

/**
 * Chat Messages Component
 * 
 * Renders the message list with support for streaming, tool results, and markdown
 */

import { ToolResultCard } from './ToolResultCard';

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt?: Date | string;
  toolInvocations?: Array<{
    toolName: string;
    args: Record<string, unknown>;
    state: string;
    result?: unknown;
  }>;
}

interface ChatMessagesProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  isLoading?: boolean;
  onRetry?: () => void;
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  return (
    <div className="p-4 space-y-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
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
          <div className="flex-1">
            <div className="inline-flex items-center gap-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  // Check for tool invocations
  const toolInvocations = message.toolInvocations || [];

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800'
        }`}
      >
        {isUser ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
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
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        {/* Tool Results (shown before text for assistant) */}
        {isAssistant && toolInvocations.length > 0 && (
          <div className="mb-2 space-y-2">
            {toolInvocations.map((invocation: { toolName: string; args: Record<string, unknown>; state: string; result?: unknown }, index: number) => (
              <ToolResultCard
                key={`${message.id}-tool-${index}`}
                toolName={invocation.toolName}
                args={invocation.args}
                state={invocation.state}
                result={invocation.result}
              />
            ))}
          </div>
        )}

        {/* Text Content */}
        {message.content && (
          <div
            className={`inline-block px-4 py-2 rounded-2xl ${
              isUser
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-tl-sm'
            }`}
          >
            <div className="text-sm whitespace-pre-wrap">
              <FormattedContent content={message.content} isUser={isUser} />
            </div>
          </div>
        )}

        {/* Timestamp */}
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

interface FormattedContentProps {
  content: string;
  isUser: boolean;
}

function FormattedContent({ content, isUser }: FormattedContentProps) {
  // Simple markdown-like formatting
  // Bold: **text**
  // Code: `code`
  // Lists: - item
  
  if (isUser) {
    return <>{content}</>;
  }

  // Process the content
  const lines = content.split('\n');
  
  return (
    <>
      {lines.map((line, lineIndex) => {
        // Check for list items
        if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
          return (
            <div key={lineIndex} className="flex gap-2">
              <span>•</span>
              <span>{formatInlineText(line.replace(/^[\s]*[-•]\s*/, ''))}</span>
            </div>
          );
        }
        
        // Check for numbered lists
        const numberedMatch = line.trim().match(/^(\d+)\.\s/);
        if (numberedMatch) {
          return (
            <div key={lineIndex} className="flex gap-2">
              <span>{numberedMatch[1]}.</span>
              <span>{formatInlineText(line.replace(/^[\s]*\d+\.\s*/, ''))}</span>
            </div>
          );
        }

        // Regular line
        return (
          <span key={lineIndex}>
            {formatInlineText(line)}
            {lineIndex < lines.length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}

function formatInlineText(text: string): React.ReactNode {
  // Process bold and code
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Check for bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Check for inline code
    const codeMatch = remaining.match(/`(.+?)`/);

    if (boldMatch && (!codeMatch || boldMatch.index! < codeMatch.index!)) {
      // Add text before bold
      if (boldMatch.index! > 0) {
        parts.push(remaining.substring(0, boldMatch.index));
      }
      // Add bold text
      parts.push(
        <strong key={key++} className="font-semibold">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.substring(boldMatch.index! + boldMatch[0].length);
    } else if (codeMatch) {
      // Add text before code
      if (codeMatch.index! > 0) {
        parts.push(remaining.substring(0, codeMatch.index));
      }
      // Add code
      parts.push(
        <code
          key={key++}
          className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.substring(codeMatch.index! + codeMatch[0].length);
    } else {
      // No more matches
      parts.push(remaining);
      break;
    }
  }

  return parts.length > 0 ? parts : text;
}

function formatTime(date?: Date | string): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

