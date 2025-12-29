"use client";

import React, { useState, useEffect } from "react";
import {
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
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
}

interface InvoiceSplitViewProps {
  transactions: Transaction[];
  documentUrls: Record<string, string>;
  onEdit: (transactionId: string, updates: Partial<Document>) => Promise<void>;
  onDelete: (transactionId: string, documentId: string) => Promise<void>;
  onConfirm: (transactionId: string) => Promise<void>;
  onViewDocument: (documentId: string) => void;
  onEditingChange?: (isEditing: boolean) => void;
}

export default function InvoiceSplitView({
  transactions,
  documentUrls,
  onEdit,
  onDelete,
  onConfirm,
  onViewDocument,
  onEditingChange,
}: InvoiceSplitViewProps) {
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(
    transactions.length > 0 && transactions[0].document_id ? transactions[0].id : null
  );
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  
  // Notify parent when editing state changes
  React.useEffect(() => {
    onEditingChange?.(editingTransactionId !== null);
  }, [editingTransactionId, onEditingChange]);
  const [editData, setEditData] = useState<Record<string, Partial<Document>>>({});
  const [showDeleteModal, setShowDeleteModal] = useState<{
    transactionId: string;
    documentId: string;
  } | null>(null);

  useEffect(() => {
    if (transactions.length > 0 && !selectedTransactionId) {
      const firstWithDoc = transactions.find((tx) => tx.document_id);
      if (firstWithDoc) {
        setSelectedTransactionId(firstWithDoc.id);
      }
    }
  }, [transactions, selectedTransactionId]);

  const selectedTransaction = transactions.find((tx) => tx.id === selectedTransactionId);
  const selectedDoc = selectedTransaction?.document;
  const selectedDocumentUrl = selectedDoc?.id ? documentUrls[selectedDoc.id] : null;
  const isEditing = editingTransactionId === selectedTransactionId;
  const invoiceData =
    isEditing && editData[selectedTransactionId || ""]
      ? editData[selectedTransactionId || ""]
      : selectedDoc;

  const startEdit = () => {
    if (!selectedTransaction || !selectedDoc) return;
    setEditingTransactionId(selectedTransaction.id);
    setEditData({
      ...editData,
      [selectedTransaction.id]: { ...selectedDoc },
    });
  };

  const cancelEdit = () => {
    if (!selectedTransactionId) return;
    setEditingTransactionId(null);
    const newEditData = { ...editData };
    delete newEditData[selectedTransactionId];
    setEditData(newEditData);
  };

  const saveEdit = async () => {
    if (!selectedTransactionId) return;
    const updates = editData[selectedTransactionId];
    if (!updates) return;

    await onEdit(selectedTransactionId, updates);
    setEditingTransactionId(null);
  };

  const handleFieldChange = (field: string, value: any) => {
    if (!selectedTransactionId) return;
    setEditData({
      ...editData,
      [selectedTransactionId]: {
        ...editData[selectedTransactionId],
        [field]: value,
      },
    });
  };

  const handleDelete = async () => {
    if (!showDeleteModal) return;
    await onDelete(showDeleteModal.transactionId, showDeleteModal.documentId);
    setShowDeleteModal(null);
    // Select next transaction if available
    const remaining = transactions.filter((tx) => tx.id !== showDeleteModal.transactionId);
    if (remaining.length > 0) {
      const nextWithDoc = remaining.find((tx) => tx.document_id);
      setSelectedTransactionId(nextWithDoc?.id || remaining[0].id);
    } else {
      setSelectedTransactionId(null);
    }
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
      <div className="flex flex-col lg:flex-row h-[calc(100vh-300px)] min-h-[600px] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
        {/* Left Sidebar - Invoice List */}
        <div className="lg:w-80 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Invoices ({transactions.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {transactions
              .filter((tx) => tx.document_id)
              .map((tx) => {
                const doc = tx.document;
                if (!doc) return null;

                const isSelected = selectedTransactionId === tx.id;

                return (
                  <button
                    key={tx.id}
                    onClick={() => {
                      setSelectedTransactionId(tx.id);
                      setEditingTransactionId(null);
                    }}
                    className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600 dark:border-blue-400"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {doc.vendor_name || "Unknown Vendor"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          #{doc.invoice_number || "-"}
                        </p>
                      </div>
                      {tx.user_confirmed && (
                        <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0 ml-2" />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs mt-2">
                      <span className="text-gray-500 dark:text-gray-400">
                        {doc.document_date
                          ? new Date(doc.document_date).toLocaleDateString()
                          : "-"}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {doc.currency || "USD"} {doc.total_amount?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Right Panel - Invoice Details */}
        <div className="flex-1 overflow-y-auto">
          {selectedTransaction && selectedDoc && invoiceData ? (
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedDoc.vendor_name || "Unknown Vendor"}
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Invoice #{selectedDoc.invoice_number || "-"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!selectedTransaction.user_confirmed && (
                    <>
                      {isEditing ? (
                        <>
                          <button
                            onClick={saveEdit}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            <CheckCircleIcon className="h-5 w-5" />
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                          >
                            <XMarkIcon className="h-5 w-5" />
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => selectedDoc.id && onViewDocument(selectedDoc.id)}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                            title="View full document"
                          >
                            <svg
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={startEdit}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            <PencilIcon className="h-5 w-5" />
                            Edit
                          </button>
                          <button
                            onClick={() =>
                              setShowDeleteModal({
                                transactionId: selectedTransaction.id,
                                documentId: selectedDoc.id,
                              })
                            }
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                          >
                            <TrashIcon className="h-5 w-5" />
                            Delete
                          </button>
                          <button
                            onClick={() => onConfirm(selectedTransaction.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            <CheckCircleIcon className="h-5 w-5" />
                            Confirm
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Invoice Image */}
              {selectedDocumentUrl && (
                <div className="mb-6 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 dark:bg-gray-900 p-2 flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedDoc.original_filename}
                    </span>
                    <button
                      onClick={() => selectedDoc.id && onViewDocument(selectedDoc.id)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
                    >
                      Open in new tab
                    </button>
                  </div>
                  <div className="h-96 bg-white dark:bg-gray-800">
                    {selectedDoc.mime_type?.includes("pdf") ? (
                      <iframe
                        src={selectedDocumentUrl}
                        className="w-full h-full"
                        title={selectedDoc.original_filename}
                      />
                    ) : (
                      <img
                        src={selectedDocumentUrl}
                        alt={selectedDoc.original_filename}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          const iframe = document.createElement("iframe");
                          iframe.src = selectedDocumentUrl;
                          iframe.className = "w-full h-full";
                          target.parentElement?.appendChild(iframe);
                        }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Invoice Fields */}
              <InvoiceFieldsDisplay
                invoiceData={invoiceData}
                editMode={isEditing}
                onFieldChange={handleFieldChange}
                compact={false}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              Select an invoice to view details
            </div>
          )}
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

