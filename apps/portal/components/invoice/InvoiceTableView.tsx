"use client";

import React, { useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  EyeIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import InvoiceFieldsDisplay from "./InvoiceFieldsDisplay";

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

interface InvoiceTableViewProps {
  transactions: Transaction[];
  documentUrls: Record<string, string>;
  onEdit: (transactionId: string, updates: Partial<Document>) => Promise<void>;
  onDelete: (transactionId: string, documentId: string) => Promise<void>;
  onConfirm: (transactionId: string) => Promise<void>;
  onViewDocument: (documentId: string) => void;
  onEditingChange?: (isEditing: boolean) => void;
}

export default function InvoiceTableView({
  transactions,
  documentUrls,
  onEdit,
  onDelete,
  onConfirm,
  onViewDocument,
  onEditingChange,
}: InvoiceTableViewProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingRows, setEditingRows] = useState<Set<string>>(new Set());
  
  // Notify parent when editing state changes
  React.useEffect(() => {
    onEditingChange?.(editingRows.size > 0);
  }, [editingRows.size, onEditingChange]);
  const [editData, setEditData] = useState<Record<string, Partial<Document>>>({});
  const [showDeleteModal, setShowDeleteModal] = useState<{
    transactionId: string;
    documentId: string;
  } | null>(null);

  const toggleRow = (transactionId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(transactionId)) {
      newExpanded.delete(transactionId);
    } else {
      newExpanded.add(transactionId);
    }
    setExpandedRows(newExpanded);
  };

  const startEdit = (transaction: Transaction) => {
    if (!transaction.document) return;
    setEditingRows(new Set([...editingRows, transaction.id]));
    setEditData({
      ...editData,
      [transaction.id]: { ...transaction.document },
    });
    // Auto-expand if not already expanded
    if (!expandedRows.has(transaction.id)) {
      setExpandedRows(new Set([...expandedRows, transaction.id]));
    }
  };

  const cancelEdit = (transactionId: string) => {
    const newEditing = new Set(editingRows);
    newEditing.delete(transactionId);
    setEditingRows(newEditing);
    const newEditData = { ...editData };
    delete newEditData[transactionId];
    setEditData(newEditData);
  };

  const saveEdit = async (transactionId: string) => {
    const updates = editData[transactionId];
    if (!updates) return;

    await onEdit(transactionId, updates);
    cancelEdit(transactionId);
  };

  const handleFieldChange = (transactionId: string, field: string, value: any) => {
    setEditData({
      ...editData,
      [transactionId]: {
        ...editData[transactionId],
        [field]: value,
      },
    });
  };

  const handleDelete = async () => {
    if (!showDeleteModal) return;
    await onDelete(showDeleteModal.transactionId, showDeleteModal.documentId);
    setShowDeleteModal(null);
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No transactions found
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                  {/* Expand/Collapse column */}
                </th>
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
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  VAT
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
              {transactions.map((tx) => {
                const isExpanded = expandedRows.has(tx.id);
                const isEditing = editingRows.has(tx.id);
                const doc = tx.document;
                const documentUrl = doc?.id ? documentUrls[doc.id] : null;
                const invoiceData = isEditing && editData[tx.id] ? editData[tx.id] : doc;
                const lineItemCount = tx.group_transaction_ids?.length || 1;
                const displayAmount = typeof doc?.total_amount === "number"
                  ? doc.total_amount
                  : (typeof tx.amount === "number" ? tx.amount : Number(tx.amount) || 0);

                if (!doc) return null;

                return (
                  <React.Fragment key={tx.id}>
                    {/* Main Row */}
                    <tr
                      className={`${
                        tx.user_confirmed
                          ? "bg-green-50 dark:bg-green-900/20"
                          : isExpanded
                          ? "bg-blue-50 dark:bg-blue-900/20"
                          : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      } transition-colors`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleRow(tx.id)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {isExpanded ? (
                            <ChevronDownIcon className="h-5 w-5" />
                          ) : (
                            <ChevronRightIcon className="h-5 w-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {doc.document_date
                          ? new Date(doc.document_date).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        <div className="flex flex-col">
                          <span>{doc.invoice_number || "-"}</span>
                          {lineItemCount > 1 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {lineItemCount} line items
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {doc.vendor_name || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span>
                            {doc.currency || "USD"} {displayAmount.toFixed(2)}
                          </span>
                          {lineItemCount > 1 && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-200">
                              Invoice total
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {doc.currency || "USD"} {doc.tax_amount?.toFixed(2) || "0.00"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        <div>
                          <div className="font-medium">{tx.category || "Uncategorized"}</div>
                          {tx.subcategory && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {tx.subcategory}
                            </div>
                          )}
                        </div>
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
                          {doc.id && documentUrl && (
                            <button
                              onClick={() => onViewDocument(doc.id!)}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              title="View invoice"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                          )}
                          {!tx.user_confirmed && (
                            <>
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => saveEdit(tx.id)}
                                    className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                    title="Save"
                                  >
                                    <CheckCircleIcon className="h-5 w-5" />
                                  </button>
                                  <button
                                    onClick={() => cancelEdit(tx.id)}
                                    className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                                    title="Cancel"
                                  >
                                    <XMarkIcon className="h-5 w-5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => startEdit(tx)}
                                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                    title="Edit"
                                  >
                                    <PencilIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      doc.id &&
                                      setShowDeleteModal({
                                        transactionId: tx.id,
                                        documentId: doc.id,
                                      })
                                    }
                                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                    title="Delete"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => onConfirm(tx.id)}
                                    className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                    title="Confirm"
                                  >
                                    <CheckCircleIcon className="h-5 w-5" />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                          {tx.user_confirmed && (
                            <CheckCircleIcon className="h-5 w-5 text-green-500" />
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Row */}
                    {isExpanded && invoiceData && (
                      <tr>
                        <td colSpan={9} className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left Column - Invoice Image */}
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Invoice Document
                              </h3>
                              {documentUrl ? (
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                  <div className="bg-gray-100 dark:bg-gray-900 p-2 flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                      {doc.original_filename}
                                    </span>
                                    {doc.id && (
                                      <button
                                        onClick={() => onViewDocument(doc.id)}
                                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
                                      >
                                        Open in new tab
                                      </button>
                                    )}
                                  </div>
                                  <div className="h-96 bg-white dark:bg-gray-800">
                                    {doc.mime_type?.includes("pdf") ? (
                                      <iframe
                                        src={documentUrl}
                                        className="w-full h-full"
                                        title={doc.original_filename}
                                      />
                                    ) : (
                                      <img
                                        src={documentUrl}
                                        alt={doc.original_filename}
                                        className="w-full h-full object-contain"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = "none";
                                          const iframe = document.createElement("iframe");
                                          iframe.src = documentUrl;
                                          iframe.className = "w-full h-full";
                                          target.parentElement?.appendChild(iframe);
                                        }}
                                      />
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg h-96 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                                  <p className="text-gray-500 dark:text-gray-400">
                                    Document not available
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Right Column - Invoice Fields */}
                            <div>
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                  Extracted Data
                                </h3>
                                {isEditing && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => cancelEdit(tx.id)}
                                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => saveEdit(tx.id)}
                                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                      <CheckCircleIcon className="h-4 w-4" />
                                      Save Changes
                                    </button>
                                  </div>
                                )}
                              </div>
                              <InvoiceFieldsDisplay
                                invoiceData={invoiceData}
                                editMode={isEditing}
                                onFieldChange={(field, value) =>
                                  handleFieldChange(tx.id, field, value)
                                }
                                compact={false}
                              />
                              {/* Prominent Save Bar when editing */}
                              {isEditing && (
                                <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                      </svg>
                                      <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                        You have unsaved changes
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={() => cancelEdit(tx.id)}
                                        className="px-4 py-2 text-sm font-medium text-yellow-800 dark:text-yellow-200 hover:text-yellow-900 dark:hover:text-yellow-100 underline"
                                      >
                                        Discard
                                      </button>
                                      <button
                                        onClick={() => saveEdit(tx.id)}
                                        className="px-6 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                                      >
                                        <CheckCircleIcon className="h-5 w-5" />
                                        Save Changes
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Invoice?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this invoice? This action cannot be undone and will also remove the associated transaction.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

