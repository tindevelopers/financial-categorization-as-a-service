"use client";

import React, { useState, useEffect } from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import ViewSwitcher, {
  getStoredViewPreference,
  type ViewType,
} from "@/components/invoice/ViewSwitcher";
import InvoiceCardView from "@/components/invoice/InvoiceCardView";
import InvoiceSplitView from "@/components/invoice/InvoiceSplitView";
import InvoiceTableView from "@/components/invoice/InvoiceTableView";

// #region agent log
const DEBUG_ENDPOINT = 'http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e';
const debugLog = (loc: string, msg: string, data: Record<string, unknown>, hId: string) => {
  fetch(DEBUG_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: loc, message: msg, data, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: hId }) }).catch(() => {});
};
// #endregion

interface Document {
  id: string;
  original_filename: string;
  supabase_path: string | null;
  storage_tier: string;
  mime_type: string | null;
  vendor_name?: string | null;
  invoice_number?: string | null;
  po_number?: string | null;
  order_number?: string | null;
  document_date?: string | null;
  delivery_date?: string | null;
  paid_date?: string | null;
  total_amount?: number | null;
  tax_amount?: number | null;
  subtotal_amount?: number | null;
  fee_amount?: number | null;
  shipping_amount?: number | null;
  currency?: string | null;
  line_items?: Array<{
    description: string;
    quantity?: number;
    unit_price?: number;
    total: number;
  }> | null;
  payment_method?: string | null;
  notes?: string | null;
  field_confidence?: Record<string, number> | null;
  extraction_methods?: Record<string, string> | null;
}

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
  invoice_number: string | null;
  document_id: string | null;
  document?: Document | null;
}

interface TransactionReviewProps {
  jobId: string;
}

export default function TransactionReview({ jobId }: TransactionReviewProps) {
  // #region agent log
  debugLog('TransactionReview.tsx:mount', 'TransactionReview component mounted with new UI', { jobId, hasViewSwitcher: true }, 'H1');
  // #endregion

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  
  // #region agent log
  let initialView: ViewType = 'table';
  try {
    initialView = getStoredViewPreference();
    debugLog('TransactionReview.tsx:getStoredViewPreference', 'View preference retrieved', { initialView }, 'H2');
  } catch (e) {
    debugLog('TransactionReview.tsx:getStoredViewPreference:error', 'Failed to get view preference', { error: String(e) }, 'H2');
  }
  // #endregion
  
  const [currentView, setCurrentView] = useState<ViewType>(initialView);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTransactions();
    // Poll for updates if job is still processing
    const interval = setInterval(() => {
      loadTransactions();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    // Load document URLs for all transactions with documents
    const loadDocumentUrls = async () => {
      const transactionsWithDocs = transactions.filter(
        (tx) => tx.document_id && !documentUrls[tx.document_id]
      );

      if (transactionsWithDocs.length === 0) return;

      const newUrls: Record<string, string> = {};
      const newLoadingUrls = new Set(loadingUrls);

      for (const tx of transactionsWithDocs) {
        if (!tx.document_id || documentUrls[tx.document_id]) continue;

        newLoadingUrls.add(tx.document_id);
        try {
          const response = await fetch(`/api/documents/${tx.document_id}/download`, {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            if (data.downloadUrl) {
              newUrls[tx.document_id] = data.downloadUrl;
            }
          }
        } catch (err) {
          console.error(`Error loading document URL for ${tx.document_id}:`, err);
        } finally {
          newLoadingUrls.delete(tx.document_id);
        }
      }

      setDocumentUrls((prev) => ({ ...prev, ...newUrls }));
      setLoadingUrls(newLoadingUrls);
    };

    loadDocumentUrls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  const loadTransactions = async () => {
    try {
      const response = await fetch(`/api/categorization/jobs/${jobId}/transactions`);
      if (!response.ok) {
        throw new Error("Failed to load transactions");
      }
      const data = await response.json();
      const newTransactions = data.transactions || [];

      // #region agent log
      debugLog('TransactionReview.tsx:loadTransactions', 'Transactions loaded', { 
        count: newTransactions.length, 
        hasDocuments: newTransactions.filter((t: Transaction) => t.document).length,
        sampleFields: newTransactions[0] ? Object.keys(newTransactions[0]) : []
      }, 'H3');
      // #endregion

      // Only update if we have transactions or if we're still loading
      if (newTransactions.length > 0 || loading) {
        setTransactions(newTransactions);
        setLoading(false);
      }
      // If no transactions yet but job exists, keep loading state
    } catch (err: any) {
      // #region agent log
      debugLog('TransactionReview.tsx:loadTransactions:error', 'Failed to load transactions', { error: err.message }, 'H3');
      // #endregion
      setError(err.message);
      setLoading(false);
    }
  };

  const handleConfirm = async (transactionId: string) => {
    try {
      const response = await fetch(`/api/categorization/transactions/${transactionId}/confirm`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to confirm");
      await loadTransactions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEdit = async (transactionId: string, updates: Partial<Document>) => {
    const transaction = transactions.find((tx) => tx.id === transactionId);
    if (!transaction?.document_id) {
      throw new Error("Transaction or document not found");
    }

    try {
      const response = await fetch(`/api/documents/${transaction.document_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update invoice");
      }

      await loadTransactions();
    } catch (err: any) {
      throw new Error(err.message || "Failed to update invoice");
    }
  };

  const handleDelete = async (transactionId: string, documentId: string) => {
    try {
      // Delete the document (this will cascade to transaction)
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete invoice");
      }

      // Remove from document URLs cache
      setDocumentUrls((prev) => {
        const newUrls = { ...prev };
        delete newUrls[documentId];
        return newUrls;
      });

      await loadTransactions();
    } catch (err: any) {
      throw new Error(err.message || "Failed to delete invoice");
    }
  };

  const handleViewDocument = (documentId: string) => {
    const url = documentUrls[documentId];
    if (url) {
      window.open(url, "_blank");
    }
  };

  const handleExportToGoogleSheets = async () => {
    setExporting(true);
    try {
      const response = await fetch(`/api/categorization/jobs/${jobId}/export/google-sheets`, {
        method: "POST",
      });

      const contentType = response.headers.get("content-type") || "unknown";

      // Check if response is CSV (fallback when Google Sheets API not configured)
      if (contentType.includes("text/csv") || contentType.includes("application/csv")) {
        const csvData = await response.text();
        const blob = new Blob([csvData], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
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
        try {
          const error = await response.json();
          throw new Error(error.error || error.message || "Export failed");
        } catch (jsonError) {
          throw new Error(`Export failed: ${response.statusText || response.status}`);
        }
      }

      const data = await response.json();

      if (data.sheetUrl) {
        window.open(data.sheetUrl, "_blank");
        alert("Google Sheet created successfully! Opening in new tab...");
      } else if (data.csvAvailable) {
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
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Processing your transactions...</p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          This may take a few moments
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">{error}</p>
        <button
          onClick={() => {
            setError(null);
            loadTransactions();
          }}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">
          Waiting for transactions to be processed...
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          The AI is categorizing your transactions
        </p>
      </div>
    );
  }

  const confirmedCount = transactions.filter((t) => t.user_confirmed).length;
  const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const renderView = () => {
    // #region agent log
    debugLog('TransactionReview.tsx:renderView', 'Rendering view', { 
      currentView, 
      transactionCount: transactions.length,
      hasViewSwitcher: true
    }, 'H1');
    // #endregion
    
    const commonProps = {
      transactions,
      documentUrls,
      onEdit: handleEdit,
      onDelete: handleDelete,
      onConfirm: handleConfirm,
      onViewDocument: handleViewDocument,
    };

    switch (currentView) {
      case "card":
        return <InvoiceCardView {...commonProps} />;
      case "split":
        return <InvoiceSplitView {...commonProps} />;
      case "table":
        return <InvoiceTableView {...commonProps} />;
      default:
        return <InvoiceTableView {...commonProps} />;
    }
  };

  // #region agent log
  debugLog('TransactionReview.tsx:render', 'NEW UI rendering with ViewSwitcher', { 
    currentView, 
    transactionCount: transactions.length,
    confirmed: confirmedCount,
    totalAmount,
    componentVersion: 'v2-with-view-switcher'
  }, 'H5');
  // #endregion

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

      {/* View Switcher and Export */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <ViewSwitcher currentView={currentView} onViewChange={setCurrentView} />
        <button
          onClick={handleExportToGoogleSheets}
          disabled={exporting || transactions.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowDownTrayIcon className="h-5 w-5" />
          {exporting ? "Exporting..." : "Export to Google Sheets"}
        </button>
      </div>

      {/* Selected View */}
      {renderView()}
    </div>
  );
}
