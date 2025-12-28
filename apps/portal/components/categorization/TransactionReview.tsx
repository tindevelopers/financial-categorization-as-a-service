"use client";

import React, { useState, useEffect } from "react";
import { 
  CheckCircleIcon, 
  ArrowDownTrayIcon,
  PencilIcon,
  EyeIcon,
  XMarkIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

interface Document {
  id: string;
  original_filename: string;
  supabase_path: string | null;
  storage_tier: string;
  mime_type: string | null;
}

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
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
  supplier_id: string | null;
  document_id: string | null;
  document?: Document | null;
  supplier?: Supplier | null;
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
  const [editSupplierId, setEditSupplierId] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [viewingDocumentId, setViewingDocumentId] = useState<string | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<Record<string, string[]>>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showNewSupplierForm, setShowNewSupplierForm] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  useEffect(() => {
    loadTransactions();
    loadCategories();
    loadSuppliers();
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
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || errorData.details || "Failed to load transactions");
      }
      
      const data = await response.json();
      const newTransactions = data.transactions || [];
      
      setTransactions(newTransactions);
      setLoading(false);
      
      if (newTransactions.length === 0) {
        console.log('No transactions found for job:', jobId);
      }
    } catch (err: any) {
      console.error("Error loading transactions:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categorization/categories', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
        setSubcategories(data.subcategories || {});
      }
    } catch (err) {
      console.error("Error loading categories:", err);
    }
  };

  const loadSuppliers = async () => {
    try {
      const response = await fetch('/api/categorization/suppliers', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (err) {
      console.error("Error loading suppliers:", err);
    }
  };

  const handleViewDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/download`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setDocumentUrl(data.downloadUrl);
        setViewingDocumentId(documentId);
      } else {
        alert("Failed to load document");
      }
    } catch (err) {
      console.error("Error loading document:", err);
      alert("Failed to load document");
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

  const handleUpdateTransaction = async (id: string) => {
    try {
      const response = await fetch(`/api/categorization/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          category: editCategory,
          subcategory: editSubcategory || null,
          supplier_id: editSupplierId || null,
        }),
      });
      if (!response.ok) throw new Error("Failed to update");
      setEditingId(null);
      await loadTransactions();
      await loadSuppliers(); // Refresh suppliers in case a new one was created
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) {
      alert("Please enter a supplier name");
      return;
    }

    try {
      const response = await fetch('/api/categorization/suppliers', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          name: newSupplierName.trim(),
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create supplier");
      }
      const data = await response.json();
      setSuppliers([...suppliers, data.supplier]);
      setEditSupplierId(data.supplier.id);
      setNewSupplierName("");
      setShowNewSupplierForm(false);
    } catch (err: any) {
      alert(`Failed to create supplier: ${err.message}`);
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) {
      return;
    }

    setDeletingId(transactionId);
    try {
      const response = await fetch(`/api/categorization/transactions/${transactionId}`, {
        method: "DELETE",
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || "Failed to delete transaction");
      }

      // Reload transactions
      await loadTransactions();
    } catch (err: any) {
      alert(`Failed to delete transaction: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAllTransactions = async () => {
    if (!confirm(`Are you sure you want to delete all ${transactions.length} transactions? This cannot be undone.`)) {
      return;
    }

    setDeletingAll(true);
    try {
      const response = await fetch(`/api/categorization/jobs/${jobId}/transactions`, {
        method: "DELETE",
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || "Failed to delete transactions");
      }

      // Clear transactions from state
      setTransactions([]);
      alert("All transactions deleted successfully.");
    } catch (err: any) {
      alert(`Failed to delete transactions: ${err.message}`);
    } finally {
      setDeletingAll(false);
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
        try {
          const errorData = await response.json();
          const errorMessage = errorData.error || errorData.message || "Export failed";
          const guidance = errorData.guidance;
          const helpUrl = errorData.helpUrl;
          
          let fullMessage = errorMessage;
          if (guidance) {
            fullMessage += `\n\n${guidance}`;
          }
          
          if (helpUrl && errorData.error_code === "OAUTH_REQUIRED") {
            const shouldRedirect = confirm(`${fullMessage}\n\nWould you like to connect your Google account now?`);
            if (shouldRedirect) {
              window.location.href = helpUrl;
              return;
            }
          }
          
          throw new Error(fullMessage);
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

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <button
          onClick={handleDeleteAllTransactions}
          disabled={deletingAll || transactions.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <TrashIcon className="h-5 w-5" />
          {deletingAll ? "Deleting..." : "Delete All Transactions"}
        </button>
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
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Supplier
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {tx.invoice_number || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {editingId === tx.id ? (
                      <div className="space-y-2 min-w-[200px]">
                        <select
                          value={editSupplierId}
                          onChange={(e) => setEditSupplierId(e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                        >
                          <option value="">Select supplier...</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        {showNewSupplierForm ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newSupplierName}
                              onChange={(e) => setNewSupplierName(e.target.value)}
                              placeholder="New supplier name"
                              className="flex-1 px-2 py-1 border rounded text-sm"
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleCreateSupplier();
                                }
                              }}
                            />
                            <button
                              onClick={handleCreateSupplier}
                              className="px-2 py-1 bg-green-600 text-white rounded text-sm"
                              title="Create supplier"
                            >
                              <PlusIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setShowNewSupplierForm(false);
                                setNewSupplierName("");
                              }}
                              className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-sm"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowNewSupplierForm(true)}
                            className="text-xs text-blue-600 hover:text-blue-900"
                          >
                            + Add new supplier
                          </button>
                        )}
                      </div>
                    ) : (
                      <div>
                        {tx.supplier ? (
                          <span className="font-medium">{tx.supplier.name}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {tx.original_description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    ${tx.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {editingId === tx.id ? (
                      <div className="space-y-2 min-w-[200px]">
                        <select
                          value={editCategory}
                          onChange={(e) => {
                            setEditCategory(e.target.value);
                            setEditSubcategory(""); // Reset subcategory when category changes
                          }}
                          className="w-full px-2 py-1 border rounded text-sm"
                        >
                          <option value="">Select category...</option>
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                        {editCategory && subcategories[editCategory] && subcategories[editCategory].length > 0 && (
                          <select
                            value={editSubcategory}
                            onChange={(e) => setEditSubcategory(e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          >
                            <option value="">Select subcategory...</option>
                            {subcategories[editCategory].map((sub) => (
                              <option key={sub} value={sub}>
                                {sub}
                              </option>
                            ))}
                          </select>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateTransaction(tx.id)}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditCategory("");
                              setEditSubcategory("");
                              setEditSupplierId("");
                              setShowNewSupplierForm(false);
                              setNewSupplierName("");
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
                      {tx.document_id && (
                        <button
                          onClick={() => handleViewDocument(tx.document_id!)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View invoice"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteTransaction(tx.id)}
                        disabled={deletingId === tx.id}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        title="Delete transaction"
                      >
                        {deletingId === tx.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        ) : (
                          <TrashIcon className="h-4 w-4" />
                        )}
                      </button>
                      {!tx.user_confirmed && (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(tx.id);
                              setEditCategory(tx.category || "");
                              setEditSubcategory(tx.subcategory || "");
                              setEditSupplierId(tx.supplier_id || "");
                              setShowNewSupplierForm(false);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit"
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

      {/* Document Viewer Modal */}
      {viewingDocumentId && documentUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">Invoice Document</h3>
              <button
                onClick={() => {
                  setViewingDocumentId(null);
                  setDocumentUrl(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe
                src={documentUrl}
                className="w-full h-full min-h-[600px] border-0"
                title="Invoice Document"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
