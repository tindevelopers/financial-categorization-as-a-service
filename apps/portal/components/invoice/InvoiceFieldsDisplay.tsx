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
  category?: string | null;
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

// Helper functions (stable, outside component)
const toDateInputValue = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return "";
  }
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return "";
};

const toDisplayDate = (v: unknown): string => {
  const input = toDateInputValue(v);
  if (!input) return "";
  const d = new Date(`${input}T00:00:00`);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
};

// Stable component defined OUTSIDE main component
const ConfidenceBadge = React.memo(function ConfidenceBadge({
  confidence,
  method,
}: {
  confidence?: number;
  method?: string;
}) {
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
});

// Common payment methods
const PAYMENT_METHODS = [
  "Cash",
  "Credit Card",
  "Debit Card",
  "Bank Transfer",
  "PayPal",
  "Direct Debit",
  "Cheque",
  "Other",
];

// Common UK business expense categories
const EXPENSE_CATEGORIES = [
  "Advertising & Marketing",
  "Bank Charges & Fees",
  "Business Insurance",
  "Business Rates",
  "Car & Vehicle Expenses",
  "Cleaning & Maintenance",
  "Computer Equipment",
  "Consultancy Fees",
  "Cost of Goods Sold",
  "Entertainment",
  "Equipment & Machinery",
  "Health & Safety",
  "IT & Software",
  "Legal & Professional Fees",
  "Meals & Subsistence",
  "Office Supplies",
  "Postage & Delivery",
  "Printing & Stationery",
  "Professional Subscriptions",
  "Rent",
  "Repairs & Maintenance",
  "Staff Training",
  "Telephone & Internet",
  "Travel & Accommodation",
  "Utilities",
  "Wages & Salaries",
  "Other Expenses",
];

// Stable SelectField component for dropdowns
const SelectField = React.memo(function SelectField({
  label,
  field,
  value,
  options,
  allowCustom = false,
  placeholder,
  editMode,
  compact,
  confidence,
  method,
  onFieldChange,
}: {
  label: string;
  field: string;
  value: any;
  options: string[];
  allowCustom?: boolean;
  placeholder?: string;
  editMode: boolean;
  compact: boolean;
  confidence?: number;
  method?: string;
  onFieldChange: (field: string, value: any) => void;
}) {
  const [isCustom, setIsCustom] = React.useState(
    value && !options.includes(value)
  );
  const displayValue = value !== null && value !== undefined ? String(value) : "";

  return (
    <div className={compact ? "mb-2" : "mb-4"}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        <ConfidenceBadge confidence={confidence} method={method} />
      </label>
      {editMode ? (
        <div className="space-y-2">
          {!isCustom ? (
            <select
              value={displayValue}
              onChange={(e) => {
                if (e.target.value === "__custom__") {
                  setIsCustom(true);
                  onFieldChange(field, "");
                } else {
                  onFieldChange(field, e.target.value || null);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="">{placeholder || `Select ${label.toLowerCase()}`}</option>
              {options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              {allowCustom && (
                <option value="__custom__">+ Add custom...</option>
              )}
            </select>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={displayValue}
                onChange={(e) => onFieldChange(field, e.target.value || null)}
                placeholder={`Enter custom ${label.toLowerCase()}`}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  setIsCustom(false);
                  onFieldChange(field, "");
                }}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-900 dark:text-white text-sm">
          {displayValue || "-"}
        </p>
      )}
    </div>
  );
});

// Stable FieldRow component defined OUTSIDE main component
const FieldRow = React.memo(function FieldRow({
  label,
  field,
  value,
  type = "text",
  placeholder,
  editMode,
  compact,
  confidence,
  method,
  onFieldChange,
}: {
  label: string;
  field: string;
  value: any;
  type?: "text" | "date" | "number";
  placeholder?: string;
  editMode: boolean;
  compact: boolean;
  confidence?: number;
  method?: string;
  onFieldChange: (field: string, value: any) => void;
}) {
  const displayValue =
    type === "date"
      ? editMode
        ? toDateInputValue(value)
        : toDisplayDate(value)
      : value !== null && value !== undefined
      ? String(value)
      : "";

  return (
    <div className={compact ? "mb-2" : "mb-4"}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        <ConfidenceBadge confidence={confidence} method={method} />
      </label>
      {editMode ? (
        <input
          type={type}
          step={type === "number" ? "0.01" : undefined}
          value={displayValue}
          onChange={(e) => {
            let newValue: any = e.target.value;
            if (type === "number") {
              newValue = e.target.value ? parseFloat(e.target.value) : null;
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
});

// Stable AmountField component defined OUTSIDE main component
const AmountField = React.memo(function AmountField({
  label,
  field,
  value,
  currency,
  editMode,
  compact,
  confidence,
  method,
  onFieldChange,
}: {
  label: string;
  field: string;
  value: number | null | undefined;
  currency?: string | null;
  editMode: boolean;
  compact: boolean;
  confidence?: number;
  method?: string;
  onFieldChange: (field: string, value: any) => void;
}) {
  const displayValue =
    value !== null && value !== undefined
      ? `${currency || "USD"} ${value.toFixed(2)}`
      : "-";

  return (
    <div className={compact ? "mb-2" : "mb-4"}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        <ConfidenceBadge confidence={confidence} method={method} />
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
            value={value ?? ""}
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
});

export default function InvoiceFieldsDisplay({
  invoiceData,
  editMode,
  onFieldChange,
  compact = false,
}: InvoiceFieldsDisplayProps) {
  const getConfidence = (field: string) => invoiceData.field_confidence?.[field];
  const getMethod = (field: string) => invoiceData.extraction_methods?.[field];

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
            editMode={editMode}
            compact={compact}
            confidence={getConfidence("invoice_number")}
            method={getMethod("invoice_number")}
            onFieldChange={onFieldChange}
          />
          <FieldRow
            label="Supplier/Vendor"
            field="vendor_name"
            value={invoiceData.vendor_name}
            editMode={editMode}
            compact={compact}
            confidence={getConfidence("vendor_name")}
            method={getMethod("vendor_name")}
            onFieldChange={onFieldChange}
          />
          <FieldRow
            label="Invoice Date"
            field="document_date"
            value={invoiceData.document_date}
            type="date"
            editMode={editMode}
            compact={compact}
            confidence={getConfidence("document_date")}
            method={getMethod("document_date")}
            onFieldChange={onFieldChange}
          />
          <FieldRow
            label="Order Number"
            field="order_number"
            value={invoiceData.order_number}
            editMode={editMode}
            compact={compact}
            confidence={getConfidence("order_number")}
            method={getMethod("order_number")}
            onFieldChange={onFieldChange}
          />
          <FieldRow
            label="PO Number"
            field="po_number"
            value={invoiceData.po_number}
            editMode={editMode}
            compact={compact}
            confidence={getConfidence("po_number")}
            method={getMethod("po_number")}
            onFieldChange={onFieldChange}
          />
          <FieldRow
            label="Delivery Date"
            field="delivery_date"
            value={invoiceData.delivery_date}
            type="date"
            editMode={editMode}
            compact={compact}
            confidence={getConfidence("delivery_date")}
            method={getMethod("delivery_date")}
            onFieldChange={onFieldChange}
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
            editMode={editMode}
            compact={compact}
            confidence={getConfidence("subtotal_amount")}
            method={getMethod("subtotal_amount")}
            onFieldChange={onFieldChange}
          />
          <AmountField
            label="VAT/Tax"
            field="tax_amount"
            value={invoiceData.tax_amount}
            currency={invoiceData.currency}
            editMode={editMode}
            compact={compact}
            confidence={getConfidence("tax_amount")}
            method={getMethod("tax_amount")}
            onFieldChange={onFieldChange}
          />
          <AmountField
            label="Fees"
            field="fee_amount"
            value={invoiceData.fee_amount}
            currency={invoiceData.currency}
            editMode={editMode}
            compact={compact}
            confidence={getConfidence("fee_amount")}
            method={getMethod("fee_amount")}
            onFieldChange={onFieldChange}
          />
          <AmountField
            label="Shipping"
            field="shipping_amount"
            value={invoiceData.shipping_amount}
            currency={invoiceData.currency}
            editMode={editMode}
            compact={compact}
            confidence={getConfidence("shipping_amount")}
            method={getMethod("shipping_amount")}
            onFieldChange={onFieldChange}
          />
          <AmountField
            label="Total Amount"
            field="total_amount"
            value={invoiceData.total_amount}
            currency={invoiceData.currency}
            editMode={editMode}
            compact={compact}
            confidence={getConfidence("total_amount")}
            method={getMethod("total_amount")}
            onFieldChange={onFieldChange}
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

      {/* Categorization */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Categorization
        </h3>
        <div className={compact ? "grid grid-cols-1 gap-2" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
          <SelectField
            label="Expense Category"
            field="category"
            value={invoiceData.category}
            options={EXPENSE_CATEGORIES}
            allowCustom={true}
            placeholder="Select category"
            editMode={editMode}
            compact={compact}
            confidence={getConfidence("category")}
            method={getMethod("category")}
            onFieldChange={onFieldChange}
          />
        </div>
      </div>

      {/* Payment Information */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Payment Information
        </h3>
        <div className={compact ? "grid grid-cols-1 gap-2" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
          <SelectField
            label="Payment Method"
            field="payment_method"
            value={invoiceData.payment_method}
            options={PAYMENT_METHODS}
            allowCustom={true}
            placeholder="Select payment method"
            editMode={editMode}
            compact={compact}
            confidence={getConfidence("payment_method")}
            method={getMethod("payment_method")}
            onFieldChange={onFieldChange}
          />
          <FieldRow
            label="Paid Date"
            field="paid_date"
            value={invoiceData.paid_date}
            type="date"
            editMode={editMode}
            compact={compact}
            confidence={getConfidence("paid_date")}
            method={getMethod("paid_date")}
            onFieldChange={onFieldChange}
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
