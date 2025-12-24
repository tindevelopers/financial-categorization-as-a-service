'use client';

/**
 * Tool Result Card Component
 * 
 * Displays AI tool invocation results in a formatted card
 */

interface ToolResultCardProps {
  toolName: string;
  args: Record<string, unknown>;
  state: 'partial-call' | 'call' | 'result' | string;
  result?: unknown;
}

export function ToolResultCard({ toolName, args, state, result }: ToolResultCardProps) {
  const isLoading = state === 'partial-call' || state === 'call';
  const hasResult = state === 'result' && result !== undefined;
  
  // Get display info based on tool name
  const toolInfo = getToolInfo(toolName);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span className="text-lg">{toolInfo.icon}</span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {toolInfo.label}
        </span>
        {isLoading && (
          <span className="ml-auto">
            <svg className="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </span>
        )}
        {hasResult && (
          <span className="ml-auto text-green-500">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </span>
        )}
      </div>

      {/* Arguments (collapsed by default) */}
      {Object.keys(args).length > 0 && (
        <details className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
            Parameters
          </summary>
          <pre className="mt-2 text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
            {JSON.stringify(args, null, 2)}
          </pre>
        </details>
      )}

      {/* Result */}
      {hasResult && (
        <div className="px-3 py-2">
          <ResultDisplay result={result} toolName={toolName} />
        </div>
      )}
    </div>
  );
}

interface ResultDisplayProps {
  result: unknown;
  toolName: string;
}

function ResultDisplay({ result, toolName }: ResultDisplayProps) {
  // Type guard
  if (typeof result !== 'object' || result === null) {
    return (
      <pre className="text-xs text-gray-600 dark:text-gray-400">
        {JSON.stringify(result, null, 2)}
      </pre>
    );
  }

  const data = result as Record<string, unknown>;

  // Handle error results
  if (data.success === false) {
    return (
      <div className="text-sm text-red-600 dark:text-red-400">
        {String(data.error) || 'An error occurred'}
      </div>
    );
  }

  // Custom rendering based on tool type
  switch (toolName) {
    case 'queryTransactions':
      return <TransactionResults data={data} />;
    case 'searchKnowledge':
      return <KnowledgeResults data={data} />;
    case 'getJobStats':
      return <JobStatsResults data={data} />;
    case 'updateTransaction':
    case 'syncGoogleSheets':
    case 'exportData':
      return <GenericSuccessResult data={data} />;
    default:
      return (
        <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto max-h-40">
          {JSON.stringify(result, null, 2)}
        </pre>
      );
  }
}

function TransactionResults({ data }: { data: Record<string, unknown> }) {
  const transactions = data.transactions as Array<{
    description: string;
    amount: number;
    date: string;
    category: string;
  }> | undefined;

  const summary = data.summary as { totalAmount?: string; categories?: string[] } | undefined;

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-700 dark:text-gray-300">
        Found {String(data.count)} transaction(s)
        {summary?.totalAmount && ` • Total: £${summary.totalAmount}`}
      </div>
      
      {transactions && transactions.length > 0 && (
        <div className="space-y-1">
          {transactions.slice(0, 5).map((tx, i) => (
            <div key={i} className="flex justify-between text-xs text-gray-600 dark:text-gray-400 py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <span className="truncate flex-1">{tx.description}</span>
              <span className="ml-2 font-mono">£{tx.amount}</span>
              <span className="ml-2 text-gray-400">{tx.category}</span>
            </div>
          ))}
          {transactions.length > 5 && (
            <div className="text-xs text-gray-500">
              ...and {transactions.length - 5} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KnowledgeResults({ data }: { data: Record<string, unknown> }) {
  const results = data.results as Array<{
    content: string;
    relevance: string;
  }> | undefined;

  if (!data.found) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        No relevant information found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-700 dark:text-gray-300">
        Found {String(data.count)} relevant result(s)
      </div>
      
      {results && results.length > 0 && (
        <div className="space-y-2">
          {results.slice(0, 3).map((r, i) => (
            <div key={i} className="text-xs text-gray-600 dark:text-gray-400 p-2 bg-white dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700">
              <div className="text-gray-400 mb-1">Relevance: {r.relevance}</div>
              <div className="line-clamp-3">{r.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JobStatsResults({ data }: { data: Record<string, unknown> }) {
  const summary = data.summary as {
    totalJobs?: number;
    totalTransactions?: number;
    overallConfirmationRate?: string;
  } | undefined;

  if (!data.found) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        No jobs found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {summary && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-white dark:bg-gray-800 rounded">
            <div className="text-lg font-semibold text-blue-600">{summary.totalJobs || 0}</div>
            <div className="text-xs text-gray-500">Jobs</div>
          </div>
          <div className="p-2 bg-white dark:bg-gray-800 rounded">
            <div className="text-lg font-semibold text-green-600">{summary.totalTransactions || 0}</div>
            <div className="text-xs text-gray-500">Transactions</div>
          </div>
          <div className="p-2 bg-white dark:bg-gray-800 rounded">
            <div className="text-lg font-semibold text-purple-600">{summary.overallConfirmationRate || '0%'}</div>
            <div className="text-xs text-gray-500">Confirmed</div>
          </div>
        </div>
      )}
    </div>
  );
}

function GenericSuccessResult({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="text-sm text-gray-700 dark:text-gray-300">
      {String(data.message || 'Operation completed successfully')}
    </div>
  );
}

function getToolInfo(toolName: string): { icon: string; label: string } {
  const toolMap: Record<string, { icon: string; label: string }> = {
    queryTransactions: { icon: '🔍', label: 'Searching transactions' },
    updateTransaction: { icon: '✏️', label: 'Updating transaction' },
    syncGoogleSheets: { icon: '📊', label: 'Syncing with Google Sheets' },
    searchKnowledge: { icon: '📚', label: 'Searching knowledge base' },
    getJobStats: { icon: '📈', label: 'Getting job statistics' },
    exportData: { icon: '📥', label: 'Exporting data' },
  };

  return toolMap[toolName] || { icon: '⚙️', label: toolName };
}

