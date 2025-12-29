"use client";

import React from "react";

interface LineItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  total: number;
}

interface InvoiceData {
  invoice_number?: string | null;
  vendor_name?: string | null;
  document_date?: string | null;
  order_number?: string | null;
  delivery_date?: string | null;
  po_number?: string | null;
  subtotal_amount?: number | null;
  tax_amount?: number | null;
  fee_amount?: number | null;
  shipping_amount?: number | null;
  total_amount?: number | null;
  currency?: string | null;
  line_items?: LineItem[] | null;
  payment_method?: string | null;
  paid_date?: string | null;
  notes?: string | null;
  field_confidence?: Record<string, number> | null;
  extraction_methods?: Record<string, string> | null;
}

interface InvoiceFieldsDisplayProps {
  invoiceData: InvoiceData;
  editMode: boolean;
  onFieldChange: (field: string, value: any) => void;
  compact?: boolean;
}

export default function InvoiceFieldsDisplay({
  invoiceData,
  editMode,
  onFieldChange,
  compact = false,
}: InvoiceFieldsDisplayProps) {
  // #region agent log
  React.useEffect(() => {
    fetch("http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "apps/portal/components/invoice/InvoiceFieldsDisplay.tsx:mount",
        message: "InvoiceFieldsDisplay mounted",
        data: {
          editMode,
          compact,
          hasInvoiceData: !!invoiceData,
          invoiceNumber: invoiceData?.invoice_number,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "layer-1",
        hypothesisId: "LAYER4",
      }),
    }).catch(() => {});
  }, [editMode, compact, invoiceData?.invoice_number]);
  // #endregion
  const isValidDateInputValue = (v: unknown) =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

  const getFieldConfidence = (field: string): number | undefined => {
    return invoiceData.field_confidence?.[field];
  };

  const getExtractionMethod = (field: string): string | undefined => {
    return invoiceData.extraction_methods?.[field];
  };

  const ConfidenceBadge = ({ field }: { field: string }) => {
    const confidence = getFieldConfidence(field);
    const method = getExtractionMethod(field);
    if (confidence === undefined) return null;

    const confidenceColor =
      confidence >= 0.8
        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
        : confidence >= 0.5
        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";

    return (
      <span
        className={`ml-2 text-xs px-1.5 py-0.5 rounded ${confidenceColor}`}
        title={`${method || "unknown"} extraction, ${Math.round(confidence * 100)}% confidence`}
      >
        {Math.round(confidence * 100)}%
      </span>
    );
  };

  const FieldRow = ({
    label,
    field,
    value,
    type = "text",
    placeholder,
  }: {
    label: string;
    field: string;
    value: any;
    type?: "text" | "date" | "number";
    placeholder?: string;
  }) => {
    const displayValue =
      type === "date" && value
        ? new Date(value).toLocaleDateString()
        : value !== null && value !== undefined
        ? String(value)
        : "";

    return (
      <div className={compact ? "mb-2" : "mb-4"}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
          <ConfidenceBadge field={field} />
        </label>
        {editMode ? (
          <input
            type={type}
            step={type === "number" ? "0.01" : undefined}
            value={displayValue}
            onFocus={(e) => {
              // #region agent log
              fetch("http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "apps/portal/components/invoice/InvoiceFieldsDisplay.tsx:inputFocus",
                  message: "Input focused",
                  data: {
                    field,
                    type,
                    editMode,
                    displayValue,
                    inputDisabled: e.target.disabled,
                    inputReadOnly: e.target.readOnly,
                    computedStyle: window.getComputedStyle(e.target).pointerEvents,
                    zIndex: window.getComputedStyle(e.target).zIndex,
                    parentZIndex: e.target.parentElement ? window.getComputedStyle(e.target.parentElement).zIndex : null,
                  },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "layer-1",
                  hypothesisId: "LAYER1",
                }),
              }).catch(() => {});
              // #endregion
              if (type === "date") {
                // #region agent log
                fetch("http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    location: "apps/portal/components/invoice/InvoiceFieldsDisplay.tsx:dateFocus",
                    message: "Date input focused",
                    data: {
                      field,
                      rawValueType: typeof value,
                      rawValue: typeof value === "string" ? value.slice(0, 32) : value,
                      displayValue,
                      displayValueValidForDateInput: isValidDateInputValue(displayValue),
                    },
                    timestamp: Date.now(),
                    sessionId: "debug-session",
                    runId: "date-1",
                    hypothesisId: "DATE1",
                  }),
                }).catch(() => {});
                // #endregion
              }
            }}
            onClick={(e) => {
              // #region agent log
              fetch("http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "apps/portal/components/invoice/InvoiceFieldsDisplay.tsx:inputClick",
                  message: "Input clicked",
                  data: {
                    field,
                    type,
                    editMode,
                    targetTag: (e.target as HTMLElement).tagName,
                    targetType: (e.target as HTMLInputElement).type,
                    clickX: e.clientX,
                    clickY: e.clientY,
                    elementAtPoint: document.elementFromPoint(e.clientX, e.clientY)?.tagName,
                  },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "layer-1",
                  hypothesisId: "LAYER2",
                }),
              }).catch(() => {});
              // #endregion
            }}
            onChange={(e) => {
              // #region agent log
              fetch("http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "apps/portal/components/invoice/InvoiceFieldsDisplay.tsx:inputChange",
                  message: "Input changed",
                  data: {
                    field,
                    type,
                    editMode,
                    newValue: e.target.value,
                    valueLength: e.target.value.length,
                  },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "layer-1",
                  hypothesisId: "LAYER3",
                }),
              }).catch(() => {});
              // #endregion
              let newValue: any = e.target.value;
              if (type === "number") {
                newValue = e.target.value ? parseFloat(e.target.value) : null;
              }
              if (type === "date") {
                // #region agent log
                fetch("http://127.0.0.1:7242/ingest/0754215e-ba8c-4aec-82a2-3bd1cb63174e", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    location: "apps/portal/components/invoice/InvoiceFieldsDisplay.tsx:dateChange",
                    message: "Date input changed",
                    data: {
                      field,
                      newValue,
                      newValueValidForDateInput: isValidDateInputValue(newValue),
                    },
                    timestamp: Date.now(),
                    sessionId: "debug-session",
                    runId: "date-1",
                    hypothesisId: "DATE1",
                  }),
                }).catch(() => {});
                // #endregion
              }
              onFieldChange(field, newValue);
            }}
            placeholder={placeholder || `Enter ${label.toLowerCase()}`}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
          />
        ) : (
          <p className="text-gray-900 dark:text-white text-sm">
            {displayValue || "-"}
          </p>
        )}
      </div>
    );
  };

  const AmountField = ({
    label,
    field,
    value,
    currency,
  }: {
    label: string;
    field: string;
    value: number | null | undefined;
    currency?: string | null;
  }) => {
    const displayValue =
      value !== null && value !== undefined
        ? `${currency || "USD"} ${value.toFixed(2)}`
        : "-";

    return (
      <div className={compact ? "mb-2" : "mb-4"}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
          <ConfidenceBadge field={field} />
        </label>
        {editMode ? (
          <div className="flex items-center gap-2">
            <select
              value={currency || "USD"}
              onChange={(e) => onFieldChange("currency", e.target.value)}
              className="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
            </select>
            <input
              type="number"
              step="0.01"
              value={value || ""}
              onChange={(e) =>
                onFieldChange(field, e.target.value ? parseFloat(e.target.value) : null)
              }
              placeholder="0.00"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>
        ) : (
          <p className="text-gray-900 dark:text-white text-sm font-medium">
            {displayValue}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Basic Information
        </h3>
        <div className={compact ? "grid grid-cols-1 gap-2" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
          <FieldRow
            label="Invoice Number"
            field="invoice_number"
            value={invoiceData.invoice_number}
          />
          <FieldRow
            label="Supplier/Vendor"
            field="vendor_name"
            value={invoiceData.vendor_name}
          />
          <FieldRow
            label="Invoice Date"
            field="document_date"
            value={invoiceData.document_date}
            type="date"
          />
          <FieldRow
            label="Order Number"
            field="order_number"
            value={invoiceData.order_number}
          />
          <FieldRow
            label="PO Number"
            field="po_number"
            value={invoiceData.po_number}
          />
          <FieldRow
            label="Delivery Date"
            field="delivery_date"
            value={invoiceData.delivery_date}
            type="date"
          />
        </div>
      </div>

      {/* Financial Details */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Financial Details
        </h3>
        <div className={compact ? "grid grid-cols-1 gap-2" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
          <AmountField
            label="Subtotal"
            field="subtotal_amount"
            value={invoiceData.subtotal_amount}
            currency={invoiceData.currency}
          />
          <AmountField
            label="VAT/Tax"
            field="tax_amount"
            value={invoiceData.tax_amount}
            currency={invoiceData.currency}
          />
          <AmountField
            label="Fees"
            field="fee_amount"
            value={invoiceData.fee_amount}
            currency={invoiceData.currency}
          />
          <AmountField
            label="Shipping"
            field="shipping_amount"
            value={invoiceData.shipping_amount}
            currency={invoiceData.currency}
          />
          <AmountField
            label="Total Amount"
            field="total_amount"
            value={invoiceData.total_amount}
            currency={invoiceData.currency}
          />
        </div>
      </div>

      {/* Line Items */}
      {invoiceData.line_items && invoiceData.line_items.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Line Items
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Unit Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {invoiceData.line_items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {item.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {item.quantity || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {item.unit_price
                        ? `${invoiceData.currency || "USD"} ${item.unit_price.toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {`${invoiceData.currency || "USD"} ${item.total.toFixed(2)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Information */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Payment Information
        </h3>
        <div className={compact ? "grid grid-cols-1 gap-2" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
          <FieldRow
            label="Payment Method"
            field="payment_method"
            value={invoiceData.payment_method}
            placeholder="e.g., Credit Card, Bank Transfer"
          />
          <FieldRow
            label="Paid Date"
            field="paid_date"
            value={invoiceData.paid_date}
            type="date"
          />
          <div className={compact ? "col-span-1" : "col-span-1 md:col-span-2"}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            {editMode ? (
              <textarea
                value={invoiceData.notes || ""}
                onChange={(e) => onFieldChange("notes", e.target.value)}
                placeholder="Add any additional notes..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
              />
            ) : (
              <p className="text-gray-900 dark:text-white text-sm">
                {invoiceData.notes || "-"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

