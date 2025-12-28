"use client";

import React, { useState, useEffect } from "react";
import {
  EyeIcon,
  XMarkIcon,
  CheckCircleIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";

interface InvoiceData {
  id: string;
  invoice_number?: string;
  vendor_name?: string;
  document_date?: string;
  total_amount?: number;
  tax_amount?: number;
  subtotal_amount?: number;
  currency?: string;
  documentUrl?: string;
}

interface InvoiceReviewProps {
  invoiceData: InvoiceData;
  onConfirm: (invoiceData: InvoiceData) => Promise<void>;
  onEdit: (invoiceData: InvoiceData) => Promise<void>;
  onClose: () => void;
}

export default function InvoiceReview({
  invoiceData,
  onConfirm,
  onEdit,
  onClose,
}: InvoiceReviewProps) {
  const [editing, setEditing] = useState(false);
  const [editedData, setEditedData] = useState<InvoiceData>(invoiceData);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditedData(invoiceData);
  }, [invoiceData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onEdit(editedData);
      setEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
      alert("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(editedData);
      onClose();
    } catch (error) {
      console.error("Failed to confirm:", error);
      alert("Failed to confirm invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Review Invoice
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Invoice Image */}
          <div className="flex flex-col">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Invoice Document
            </h4>
            {invoiceData.documentUrl ? (
              <div className="flex-1 border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
                {invoiceData.documentUrl.includes(".pdf") ? (
                  <iframe
                    src={invoiceData.documentUrl}
                    className="w-full h-full min-h-[500px] border-0"
                    title="Invoice Document"
                  />
                ) : (
                  <img
                    src={invoiceData.documentUrl}
                    alt="Invoice"
                    className="w-full h-auto object-contain"
                  />
                )}
              </div>
            ) : (
              <div className="flex-1 border rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-900 min-h-[500px]">
                <p className="text-gray-500 dark:text-gray-400">
                  Invoice image not available
                </p>
              </div>
            )}
          </div>

          {/* Right: Extracted Fields */}
          <div className="flex flex-col">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              Extracted Information
            </h4>
            <div className="space-y-4">
              {/* Invoice Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Invoice Number
                </label>
                {editing ? (
                  <input
                    type="text"
                    value={editedData.invoice_number || ""}
                    onChange={(e) =>
                      setEditedData({ ...editedData, invoice_number: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Enter invoice number"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">
                    {invoiceData.invoice_number || "-"}
                  </p>
                )}
              </div>

              {/* Supplier/Vendor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Supplier/Vendor
                </label>
                {editing ? (
                  <input
                    type="text"
                    value={editedData.vendor_name || ""}
                    onChange={(e) =>
                      setEditedData({ ...editedData, vendor_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Enter supplier name"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">
                    {invoiceData.vendor_name || "-"}
                  </p>
                )}
              </div>

              {/* Invoice Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Invoice Date
                </label>
                {editing ? (
                  <input
                    type="date"
                    value={editedData.document_date || ""}
                    onChange={(e) =>
                      setEditedData({ ...editedData, document_date: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">
                    {invoiceData.document_date
                      ? new Date(invoiceData.document_date).toLocaleDateString()
                      : "-"}
                  </p>
                )}
              </div>

              {/* Subtotal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subtotal
                </label>
                {editing ? (
                  <input
                    type="number"
                    step="0.01"
                    value={editedData.subtotal_amount || ""}
                    onChange={(e) =>
                      setEditedData({
                        ...editedData,
                        subtotal_amount: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="0.00"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">
                    {invoiceData.subtotal_amount !== undefined
                      ? `${invoiceData.currency || "USD"} ${invoiceData.subtotal_amount.toFixed(2)}`
                      : "-"}
                  </p>
                )}
              </div>

              {/* VAT Total */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  VAT Total
                </label>
                {editing ? (
                  <input
                    type="number"
                    step="0.01"
                    value={editedData.tax_amount || ""}
                    onChange={(e) =>
                      setEditedData({
                        ...editedData,
                        tax_amount: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="0.00"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">
                    {invoiceData.tax_amount !== undefined
                      ? `${invoiceData.currency || "USD"} ${invoiceData.tax_amount.toFixed(2)}`
                      : "-"}
                  </p>
                )}
              </div>

              {/* Invoice Total */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Invoice Total
                </label>
                {editing ? (
                  <input
                    type="number"
                    step="0.01"
                    value={editedData.total_amount || ""}
                    onChange={(e) =>
                      setEditedData({
                        ...editedData,
                        total_amount: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white font-semibold"
                    placeholder="0.00"
                  />
                ) : (
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {invoiceData.total_amount !== undefined
                      ? `${invoiceData.currency || "USD"} ${invoiceData.total_amount.toFixed(2)}`
                      : "-"}
                  </p>
                )}
              </div>

              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Currency
                </label>
                {editing ? (
                  <select
                    value={editedData.currency || "USD"}
                    onChange={(e) =>
                      setEditedData({ ...editedData, currency: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                    <option value="EUR">EUR</option>
                  </select>
                ) : (
                  <p className="text-gray-900 dark:text-white">
                    {invoiceData.currency || "USD"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 p-4 border-t dark:border-gray-700">
          {editing ? (
            <>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditedData(invoiceData);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <PencilIcon className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <CheckCircleIcon className="h-5 w-5" />
                {saving ? "Confirming..." : "Confirm & Commit"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

