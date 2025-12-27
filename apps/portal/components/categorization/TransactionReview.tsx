"use client";

import React, { useState, useEffect } from "react";
import { 
  CheckCircleIcon, 
  ArrowDownTrayIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";

interface Transaction {
  id: string;
  original_description: string;
  amount: number;
  date: string;
  category: string | null;
  subcategory: string | null;
  confidence_score: number;
  user_confirmed: boolean;
  user_notes: string | null;
}

interface TransactionReviewProps {
  jobId: string;
}

export default function TransactionReview({ jobId }: TransactionReviewProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editSubcategory, setEditSubcategory] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadTransactions();
    // Poll for updates if job is still processing
    const interval = setInterval(() => {
      loadTransactions();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const loadTransactions = async () => {
    try {
      const response = await fetch(`/api/categorization/jobs/${jobId}/transactions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || errorData.details || "Failed to load transactions");
      }
      
      const data = await response.json();
      const newTransactions = data.transactions || [];
      
      // Always update transactions and stop loading on successful response
      setTransactions(newTransactions);
      setLoading(false);
      
      // If no transactions, log for debugging
      if (newTransactions.length === 0) {
        console.log('No transactions found for job:', jobId);
      }
    } catch (err: any) {
      console.error("Error loading transactions:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      const response = await fetch(`/api/categorization/transactions/${id}/confirm`, {
        method: "POST",
        credentials: 'include',
      });
      if (!response.ok) throw new Error("Failed to confirm");
      await loadTransactions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateCategory = async (id: string) => {
    try {
      const response = await fetch(`/api/categorization/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          category: editCategory,
          subcategory: editSubcategory || null,
        }),
      });
      if (!response.ok) throw new Error("Failed to update");
      setEditingId(null);
      await loadTransactions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleExportToGoogleSheets = async () => {
    setExporting(true);
    try {
      const response = await fetch(`/api/categorization/jobs/${jobId}/export/google-sheets`, {
        method: "POST",
        credentials: 'include',
      });

      const contentType = response.headers.get("content-type") || "unknown";

      // Check if response is CSV (fallback when Google Sheets API not configured)
      if (contentType.includes("text/csv") || contentType.includes("application/csv")) {
        const csvData = await response.text();
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions-${jobId}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        alert("Google Sheets export is not configured. Downloaded as CSV instead.");
        return;
      }

      if (!response.ok) {
        // Try to parse as JSON for error message
        try {
          const errorData = await response.json();
          const errorMessage = errorData.error || errorData.message || "Export failed";
          const guidance = errorData.guidance;
          const helpUrl = errorData.helpUrl;
          
          // Build a helpful error message
          let fullMessage = errorMessage;
          if (guidance) {
            fullMessage += `\n\n${guidance}`;
          }
          
          // If there's a help URL and it's an OAuth error, offer to redirect
          if (helpUrl && errorData.error_code === "OAUTH_REQUIRED") {
            const shouldRedirect = confirm(`${fullMessage}\n\nWould you like to connect your Google account now?`);
            if (shouldRedirect) {
              window.location.href = helpUrl;
              return;
            }
          }
          
          throw new Error(fullMessage);
        } catch (jsonError) {
          // If JSON parsing fails, use status text
          throw new Error(`Export failed: ${response.statusText || response.status}`);
        }
      }
      
      const data = await response.json();
      
      if (data.sheetUrl) {
        window.open(data.sheetUrl, "_blank");
        alert("Google Sheet created successfully! Opening in new tab...");
      } else if (data.csvAvailable) {
        // Server indicates CSV is available but not configured
        alert("Google Sheets export requires additional configuration. Please contact support.");
      }
    } catch (err: any) {
      setError(err.message);
      alert(`Export error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">{error}</p>
      </div>
    );
  }

  const confirmedCount = transactions.filter(t => t.user_confirmed).length;
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Transactions</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {transactions.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Confirmed</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {confirmedCount} / {transactions.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Amount</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${totalAmount.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <button
          onClick={handleExportToGoogleSheets}
          disabled={exporting || transactions.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowDownTrayIcon className="h-5 w-5" />
          {exporting ? "Exporting..." : "Export to Google Sheets"}
        </button>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className={tx.user_confirmed ? "bg-green-50 dark:bg-green-900/20" : ""}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {new Date(tx.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {tx.original_description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    ${tx.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {editingId === tx.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          placeholder="Category"
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                        <input
                          type="text"
                          value={editSubcategory}
                          onChange={(e) => setEditSubcategory(e.target.value)}
                          placeholder="Subcategory (optional)"
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateCategory(tx.id)}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditCategory("");
                              setEditSubcategory("");
                            }}
                            className="text-xs px-2 py-1 bg-gray-300 text-gray-700 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium">{tx.category || "Uncategorized"}</div>
                        {tx.subcategory && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {tx.subcategory}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div
                        className={`h-2 w-16 rounded-full ${
                          tx.confidence_score >= 0.7
                            ? "bg-green-500"
                            : tx.confidence_score >= 0.5
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                      />
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        {Math.round(tx.confidence_score * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      {!tx.user_confirmed && (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(tx.id);
                              setEditCategory(tx.category || "");
                              setEditSubcategory(tx.subcategory || "");
                            }}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit category"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleConfirm(tx.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Confirm"
                          >
                            <CheckCircleIcon className="h-5 w-5" />
                          </button>
                        </>
                      )}
                      {tx.user_confirmed && (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
