"use client";

import React, { useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
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
}

interface InvoiceCardViewProps {
  transactions: Transaction[];
  documentUrls: Record<string, string>;
  onEdit: (transactionId: string, updates: Partial<Document>) => Promise<void>;
  onDelete: (transactionId: string, documentId: string) => Promise<void>;
  onConfirm: (transactionId: string) => Promise<void>;
  onViewDocument: (documentId: string) => void;
}

export default function InvoiceCardView({
  transactions,
  documentUrls,
  onEdit,
  onDelete,
  onConfirm,
  onViewDocument,
}: InvoiceCardViewProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [editingCards, setEditingCards] = useState<Set<string>>(new Set());
  const [editData, setEditData] = useState<Record<string, Partial<Document>>>({});
  const [showDeleteModal, setShowDeleteModal] = useState<{
    transactionId: string;
    documentId: string;
  } | null>(null);

  const toggleCard = (transactionId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(transactionId)) {
      newExpanded.delete(transactionId);
    } else {
      newExpanded.add(transactionId);
    }
    setExpandedCards(newExpanded);
  };

  const startEdit = (transaction: Transaction) => {
    if (!transaction.document) return;
    setEditingCards(new Set([...editingCards, transaction.id]));
    setEditData({
      ...editData,
      [transaction.id]: { ...transaction.document },
    });
  };

  const cancelEdit = (transactionId: string) => {
    const newEditing = new Set(editingCards);
    newEditing.delete(transactionId);
    setEditingCards(newEditing);
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {transactions.map((tx) => {
          const isExpanded = expandedCards.has(tx.id);
          const isEditing = editingCards.has(tx.id);
          const doc = tx.document;
          const documentUrl = doc?.id ? documentUrls[doc.id] : null;
          const invoiceData = isEditing && editData[tx.id] ? editData[tx.id] : doc;

          if (!doc) return null;

          return (
            <div
              key={tx.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border ${
                tx.user_confirmed
                  ? "border-green-500 dark:border-green-600"
                  : "border-gray-200 dark:border-gray-700"
              } transition-all hover:shadow-lg`}
            >
              {/* Card Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                      {doc.vendor_name || "Unknown Vendor"}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Invoice #{doc.invoice_number || "-"}
                    </p>
                  </div>
                  {tx.user_confirmed && (
                    <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
                  )}
                </div>

                {/* Key Info */}
                <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Date:</span>
                    <span className="ml-1 text-gray-900 dark:text-white">
                      {doc.document_date
                        ? new Date(doc.document_date).toLocaleDateString()
                        : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Total:</span>
                    <span className="ml-1 font-semibold text-gray-900 dark:text-white">
                      {doc.currency || "USD"} {doc.total_amount?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">VAT:</span>
                    <span className="ml-1 text-gray-900 dark:text-white">
                      {doc.currency || "USD"} {doc.tax_amount?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Category:</span>
                    <span className="ml-1 text-gray-900 dark:text-white">
                      {tx.category || "Uncategorized"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Invoice Image Thumbnail */}
              {documentUrl && (
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="relative aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden cursor-pointer group">
                    <img
                      src={documentUrl}
                      alt={doc.original_filename}
                      className="w-full h-full object-contain group-hover:opacity-75 transition-opacity"
                      onClick={() => doc.id && onViewDocument(doc.id)}
                      onError={(e) => {
                        // Fallback to iframe for PDFs
                        const target = e.target as HTMLImageElement;
                        if (doc.mime_type?.includes("pdf")) {
                          target.style.display = "none";
                          const iframe = document.createElement("iframe");
                          iframe.src = documentUrl;
                          iframe.className = "w-full h-full";
                          target.parentElement?.appendChild(iframe);
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                      <EyeIcon className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="p-4 flex items-center justify-between gap-2">
                <button
                  onClick={() => toggleCard(tx.id)}
                  className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUpIcon className="h-4 w-4" />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <ChevronDownIcon className="h-4 w-4" />
                      Show Details
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  {!tx.user_confirmed && (
                    <>
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(tx.id)}
                            className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                            title="Save"
                          >
                            <CheckCircleIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => cancelEdit(tx.id)}
                            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                            title="Cancel"
                          >
                            <XMarkIcon className="h-5 w-5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(tx)}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                            title="Edit"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => doc.id && setShowDeleteModal({ transactionId: tx.id, documentId: doc.id })}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onConfirm(tx.id)}
                            className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                            title="Confirm"
                          >
                            <CheckCircleIcon className="h-5 w-5" />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && invoiceData && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <InvoiceFieldsDisplay
                    invoiceData={invoiceData}
                    editMode={isEditing}
                    onFieldChange={(field, value) => handleFieldChange(tx.id, field, value)}
                    compact={true}
                  />
                </div>
              )}
            </div>
          );
        })}
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

