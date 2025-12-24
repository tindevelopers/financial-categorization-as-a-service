'use client';

/**
 * Suggested Actions Component
 * 
 * Shows clickable suggestion buttons based on context
 */

interface SuggestedActionsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

export function SuggestedActions({ suggestions, onSelect }: SuggestedActionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => onSelect(suggestion)}
          className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300
                     bg-white dark:bg-gray-800 
                     border border-gray-200 dark:border-gray-700
                     rounded-full
                     hover:bg-gray-50 dark:hover:bg-gray-700
                     hover:border-gray-300 dark:hover:border-gray-600
                     focus:outline-none focus:ring-2 focus:ring-blue-500
                     transition-colors"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}

