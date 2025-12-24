/**
 * System Prompts for FinCat AI Chatbot
 * 
 * Context-aware prompts that understand the user's current page and actions
 */

export interface ChatContext {
  currentPage: string;
  selectedTransactions?: string[];
  activeJob?: {
    id: string;
    status: string;
    totalItems: number;
    processedItems: number;
  } | null;
  recentActions?: Array<{
    action: string;
    timestamp: string;
    details?: Record<string, unknown>;
  }>;
  userPreferences?: {
    defaultCategory?: string;
    currency?: string;
    dateFormat?: string;
  };
}

/**
 * Build the system prompt based on current context
 */
export function buildSystemPrompt(context?: ChatContext): string {
  const basePrompt = `You are FinCat AI, an intelligent financial assistant specializing in UK tax and accounting for small businesses and self-employed professionals.

## Your Capabilities

You can help users with:
1. **Transaction Categorization** - Suggest appropriate HMRC-compliant categories for expenses and income
2. **Tax Guidance** - Explain UK tax rules, allowable expenses, VAT, and filing requirements
3. **Data Queries** - Search and filter transactions, view job summaries, and generate reports
4. **Spreadsheet Operations** - Sync data with Google Sheets, export reports
5. **Reconciliation** - Help match transactions with bank statements

## Available Tools

You have access to the following tools:
- \`queryTransactions\` - Search transactions by date, category, amount, or description
- \`updateTransaction\` - Modify category, notes, or confirmation status
- \`syncGoogleSheets\` - Push/pull data to/from connected Google Sheets
- \`searchKnowledge\` - Search the UK tax/accounting knowledge base
- \`getJobStats\` - Get statistics for categorization jobs
- \`exportData\` - Generate CSV or Excel exports

## Guidelines

1. **Always check the knowledge base first** when answering tax or accounting questions
2. **Be specific to UK tax rules** - reference HMRC guidelines where applicable
3. **When categorizing expenses**, explain the reasoning and any tax implications
4. **If uncertain**, clearly state limitations and suggest consulting an accountant
5. **Use tools proactively** - if a user asks about their transactions, use queryTransactions
6. **Confirm before making changes** - ask for confirmation before updating transactions or syncing sheets`;

  // Add context-specific instructions
  let contextPrompt = '';
  
  if (context) {
    contextPrompt = '\n\n## Current Context\n';
    
    // Page context
    if (context.currentPage) {
      contextPrompt += `\nUser is currently on: ${getPageDescription(context.currentPage)}`;
    }
    
    // Selected transactions
    if (context.selectedTransactions && context.selectedTransactions.length > 0) {
      contextPrompt += `\nUser has ${context.selectedTransactions.length} transaction(s) selected.`;
    }
    
    // Active job
    if (context.activeJob) {
      contextPrompt += `\nActive categorization job: ${context.activeJob.status} (${context.activeJob.processedItems}/${context.activeJob.totalItems} items processed)`;
    }
    
    // Recent actions
    if (context.recentActions && context.recentActions.length > 0) {
      contextPrompt += '\nRecent user actions:';
      context.recentActions.slice(0, 3).forEach(action => {
        contextPrompt += `\n- ${action.action}`;
      });
    }
  }

  return basePrompt + contextPrompt;
}

/**
 * Get human-readable page description
 */
function getPageDescription(path: string): string {
  const pageDescriptions: Record<string, string> = {
    '/dashboard': 'Dashboard overview page',
    '/dashboard/transactions': 'Transactions list page',
    '/dashboard/uploads': 'File uploads page',
    '/dashboard/review': 'Review categorized jobs page',
    '/dashboard/reconciliation': 'Bank reconciliation page',
    '/dashboard/analytics': 'Analytics and reports page',
    '/dashboard/exports': 'Export data page',
    '/dashboard/settings': 'Settings page',
    '/dashboard/setup': 'Company setup page',
    '/dashboard/chat': 'AI Chat page',
  };
  
  // Check for exact match first
  if (pageDescriptions[path]) {
    return pageDescriptions[path];
  }
  
  // Check for pattern matches
  if (path.startsWith('/dashboard/review/')) {
    return 'Reviewing a specific categorization job';
  }
  if (path.startsWith('/dashboard/transactions/')) {
    return 'Viewing transaction details';
  }
  
  return `Page: ${path}`;
}

/**
 * Generate suggested actions based on context
 */
export function getSuggestedActions(context?: ChatContext): string[] {
  const suggestions: string[] = [];
  
  if (!context) {
    return [
      'Help me categorize my transactions',
      'What expenses can I claim for tax?',
      'Show me my recent uploads',
    ];
  }
  
  // Page-specific suggestions
  switch (context.currentPage) {
    case '/dashboard':
      suggestions.push('Show me a summary of my categorization jobs');
      suggestions.push('What expenses need review?');
      break;
      
    case '/dashboard/transactions':
      suggestions.push('Filter transactions by category');
      suggestions.push('Show uncategorized transactions');
      suggestions.push('Export these transactions to Google Sheets');
      break;
      
    case '/dashboard/review':
      suggestions.push('Show transactions with low confidence');
      suggestions.push('Bulk update categories');
      break;
      
    case '/dashboard/reconciliation':
      suggestions.push('Help me understand unmatched transactions');
      suggestions.push('What does reconciliation mean?');
      break;
      
    case '/dashboard/analytics':
      suggestions.push('Break down expenses by category');
      suggestions.push('Show spending trends');
      break;
  }
  
  // Job-specific suggestions
  if (context.activeJob) {
    if (context.activeJob.status === 'reviewing') {
      suggestions.push('Show transactions that need confirmation');
      suggestions.push('Confirm all high-confidence categorizations');
    }
  }
  
  // Selection-specific suggestions
  if (context.selectedTransactions && context.selectedTransactions.length > 0) {
    suggestions.push('Categorize selected transactions');
    suggestions.push('Add notes to selected transactions');
  }
  
  // Default suggestions if none generated
  if (suggestions.length === 0) {
    suggestions.push('Help me categorize my transactions');
    suggestions.push('What expenses can I claim for tax?');
    suggestions.push('Sync my data with Google Sheets');
  }
  
  return suggestions.slice(0, 4); // Return max 4 suggestions
}

/**
 * Error messages for common scenarios
 */
export const errorMessages = {
  unauthorized: 'You need to be signed in to use the AI assistant.',
  noTransactions: 'No transactions found matching your criteria.',
  syncFailed: 'Failed to sync with Google Sheets. Please check your connection settings.',
  updateFailed: 'Failed to update the transaction. Please try again.',
  rateLimited: 'Too many requests. Please wait a moment before trying again.',
  genericError: 'Something went wrong. Please try again or contact support.',
};

/**
 * Success messages for common actions
 */
export const successMessages = {
  transactionUpdated: 'Transaction updated successfully.',
  syncCompleted: 'Google Sheets sync completed.',
  exportReady: 'Your export is ready for download.',
  categoriesConfirmed: 'Categories confirmed successfully.',
};

