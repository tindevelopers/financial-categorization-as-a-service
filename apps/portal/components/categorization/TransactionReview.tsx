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
  group_transaction_ids?: string[];
}

interface TransactionReviewProps {
  jobId: string;
}

export default function TransactionReview({ jobId }: TransactionReviewProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  
  // Track if any child view is in editing mode to pause polling
  const [isEditing, setIsEditing] = useState(false);
  
  // Initialize view from stored preference (safe for SSR)
  const [currentView, setCurrentView] = useState<ViewType>("table");
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState<Set<string>>(new Set());

  // Load stored preference on client-side
  useEffect(() => {
    setCurrentView(getStoredViewPreference());
  }, []);

  useEffect(() => {
    loadTransactions();
    // Poll for updates if job is still processing, but pause while editing
    const interval = setInterval(() => {
      if (!isEditing) {
        loadTransactions();
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, isEditing]);

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
        } catch (e) {
          console.error("Failed to load document URL:", e);
        }
        newLoadingUrls.delete(tx.document_id);
      }

      if (Object.keys(newUrls).length > 0) {
        setDocumentUrls((prev) => ({ ...prev, ...newUrls }));
      }
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
      const rawTransactions: Transaction[] = data.transactions || [];

      // Group by document_id so one uploaded invoice shows once (instead of 1 row per line item transaction)
      const grouped = new Map<string, Transaction>();
      for (const tx of rawTransactions) {
        if (!tx.document_id) {
          // Keep any orphan/placeholder transactions visible
          grouped.set(tx.id, { ...tx, group_transaction_ids: [tx.id] });
          continue;
        }
        const existing = grouped.get(tx.document_id);
        if (!existing) {
          const initialSum = Math.abs(Number(tx.amount) || 0);
          grouped.set(tx.document_id, {
            ...tx,
            // Show invoice once, but keep the list of underlying tx ids
            group_transaction_ids: [tx.id],
            // Amount on the grouped row is the sum of line-item tx amounts (used for display + summary)
            amount: initialSum,
          });
        } else {
          existing.group_transaction_ids = [
            ...(existing.group_transaction_ids || []),
            tx.id,
          ];
          // Consider the invoice confirmed only if all underlying tx are confirmed
          existing.user_confirmed = Boolean(existing.user_confirmed && tx.user_confirmed);
          // Keep the grouped row amount as the sum of underlying tx amounts
          existing.amount = (Number(existing.amount) || 0) + Math.abs(Number(tx.amount) || 0);
        }
      }

      const newTransactions = Array.from(grouped.values());

      // Only update if we have transactions or if we're still loading
      setTransactions(newTransactions);
      setLoading(false);
    } catch (err: any) {
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
      setError(err.message);
      throw err;
    }
  };

  const handleDelete = async (transactionId: string, documentId: string) => {
    try {
      // Delete the transaction first
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/components/categorization/TransactionReview.tsx:handleDelete:start',message:'Attempting delete transaction+document',data:{transactionId,documentId},timestamp:Date.now(),sessionId:'debug-session',runId:'delete-1',hypothesisId:'D1'})}).catch(()=>{});
      // #endregion

      // Delete ALL line-item transactions for this invoice (document_id) within this job.
      const txResponse = await fetch(`/api/categorization/jobs/${jobId}/transactions?documentId=${encodeURIComponent(documentId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!txResponse.ok) {
        // #region agent log
        let bodyText = "";
        try { bodyText = await txResponse.clone().text(); } catch {}
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/components/categorization/TransactionReview.tsx:handleDelete:txFail',message:'Transaction delete failed',data:{transactionId,status:txResponse.status,statusText:txResponse.statusText,bodyText:bodyText.slice(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'delete-1',hypothesisId:'D2'})}).catch(()=>{});
        // #endregion
        throw new Error("Failed to delete transaction");
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/components/categorization/TransactionReview.tsx:handleDelete:txOk',message:'Transaction(s) delete ok',data:{transactionId,documentId,status:txResponse.status},timestamp:Date.now(),sessionId:'debug-session',runId:'delete-1',hypothesisId:'D2'})}).catch(()=>{});
      // #endregion

      // Then delete the document
      const docResponse = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!docResponse.ok) {
        // #region agent log
        let bodyText = "";
        try { bodyText = await docResponse.clone().text(); } catch {}
        fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/components/categorization/TransactionReview.tsx:handleDelete:docFail',message:'Document delete failed (tx deleted already)',data:{documentId,status:docResponse.status,statusText:docResponse.statusText,bodyText:bodyText.slice(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'delete-1',hypothesisId:'D3'})}).catch(()=>{});
        // #endregion
        console.warn("Failed to delete document, transaction was deleted");
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apps/portal/components/categorization/TransactionReview.tsx:handleDelete:docOk',message:'Document delete ok',data:{documentId,status:docResponse.status},timestamp:Date.now(),sessionId:'debug-session',runId:'delete-1',hypothesisId:'D3'})}).catch(()=>{});
      // #endregion

      await loadTransactions();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const handleViewDocument = (documentId: string) => {
    const url = documentUrls[documentId];
    if (url) {
      window.open(url, "_blank");
    }
  };

  const handleExportToGoogleSheets = async () => {
    try {
      setExporting(true);
      const response = await fetch(
        `/api/categorization/jobs/${jobId}/export/google-sheets`,
        {
        method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to export");
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
        <p className="text-gray-600 dark:text-gray-400">
          No invoices found for this review job.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          If you just uploaded, give it a moment and refresh. If you deleted the last invoice, this is expected.
        </p>
      </div>
    );
  }

  const confirmedCount = transactions.filter((t) => t.user_confirmed).length;
  const totalAmount = transactions.reduce((sum, t) => {
    const docTotal = typeof t.document?.total_amount === "number" ? t.document.total_amount : null;
    const amt = docTotal !== null ? docTotal : Math.abs(Number(t.amount) || 0);
    return sum + amt;
  }, 0);

  const renderView = () => {
    const commonProps = {
      transactions,
      documentUrls,
      onEdit: handleEdit,
      onDelete: handleDelete,
      onConfirm: handleConfirm,
      onViewDocument: handleViewDocument,
      onEditingChange: setIsEditing,
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
