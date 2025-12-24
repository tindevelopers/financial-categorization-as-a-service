'use client';

/**
 * Chat Context Provider
 * 
 * Provides context awareness for the AI chatbot, tracking:
 * - Current page/route
 * - Selected transactions
 * - Active job
 * - Recent user actions
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';

export interface ChatContextData {
  currentPage: string;
  selectedTransactions: string[];
  activeJob: {
    id: string;
    status: string;
    totalItems: number;
    processedItems: number;
  } | null;
  recentActions: Array<{
    action: string;
    timestamp: string;
    details?: Record<string, unknown>;
  }>;
  userPreferences: {
    defaultCategory?: string;
    currency: string;
    dateFormat: string;
  };
}

interface ChatContextValue {
  context: ChatContextData;
  // Methods to update context
  setSelectedTransactions: (ids: string[]) => void;
  addSelectedTransaction: (id: string) => void;
  removeSelectedTransaction: (id: string) => void;
  clearSelectedTransactions: () => void;
  setActiveJob: (job: ChatContextData['activeJob']) => void;
  logAction: (action: string, details?: Record<string, unknown>) => void;
  updatePreferences: (prefs: Partial<ChatContextData['userPreferences']>) => void;
  // Chat session management
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleChat: () => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

const MAX_RECENT_ACTIONS = 10;

interface ChatContextProviderProps {
  children: ReactNode;
}

export function ChatContextProvider({ children }: ChatContextProviderProps) {
  const pathname = usePathname();
  
  // Chat visibility state
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Context data
  const [context, setContext] = useState<ChatContextData>({
    currentPage: pathname,
    selectedTransactions: [],
    activeJob: null,
    recentActions: [],
    userPreferences: {
      currency: 'GBP',
      dateFormat: 'DD/MM/YYYY',
    },
  });

  // Update current page when pathname changes
  useEffect(() => {
    setContext(prev => ({
      ...prev,
      currentPage: pathname,
    }));
    
    // Log page navigation
    logAction('navigated', { to: pathname });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Transaction selection methods
  const setSelectedTransactions = useCallback((ids: string[]) => {
    setContext(prev => ({
      ...prev,
      selectedTransactions: ids,
    }));
  }, []);

  const addSelectedTransaction = useCallback((id: string) => {
    setContext(prev => ({
      ...prev,
      selectedTransactions: prev.selectedTransactions.includes(id)
        ? prev.selectedTransactions
        : [...prev.selectedTransactions, id],
    }));
  }, []);

  const removeSelectedTransaction = useCallback((id: string) => {
    setContext(prev => ({
      ...prev,
      selectedTransactions: prev.selectedTransactions.filter(t => t !== id),
    }));
  }, []);

  const clearSelectedTransactions = useCallback(() => {
    setContext(prev => ({
      ...prev,
      selectedTransactions: [],
    }));
  }, []);

  // Active job management
  const setActiveJob = useCallback((job: ChatContextData['activeJob']) => {
    setContext(prev => ({
      ...prev,
      activeJob: job,
    }));
    
    if (job) {
      logAction('viewed_job', { jobId: job.id, status: job.status });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Action logging
  const logAction = useCallback((action: string, details?: Record<string, unknown>) => {
    setContext(prev => {
      const newAction = {
        action,
        timestamp: new Date().toISOString(),
        details,
      };
      
      const recentActions = [newAction, ...prev.recentActions].slice(0, MAX_RECENT_ACTIONS);
      
      return {
        ...prev,
        recentActions,
      };
    });
  }, []);

  // Preferences management
  const updatePreferences = useCallback((prefs: Partial<ChatContextData['userPreferences']>) => {
    setContext(prev => ({
      ...prev,
      userPreferences: {
        ...prev.userPreferences,
        ...prefs,
      },
    }));
  }, []);

  // Toggle chat visibility
  const toggleChat = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const value: ChatContextValue = {
    context,
    setSelectedTransactions,
    addSelectedTransaction,
    removeSelectedTransaction,
    clearSelectedTransactions,
    setActiveJob,
    logAction,
    updatePreferences,
    sessionId,
    setSessionId,
    isOpen,
    setIsOpen,
    toggleChat,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

// Custom hook to use chat context
export function useChatContext() {
  const context = useContext(ChatContext);
  
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatContextProvider');
  }
  
  return context;
}

// Hook to get just the context data (for passing to API)
export function useChatContextData() {
  const { context } = useChatContext();
  return context;
}

