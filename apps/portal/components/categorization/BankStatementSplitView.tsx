"use client";

import React from "react";
import { CheckCircleIcon, PencilIcon, XMarkIcon } from "@heroicons/react/24/outline";

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
  is_debit?: boolean | null;
  payee_name?: string | null;
  payer_name?: string | null;
  paid_in_amount?: number | null;
  paid_out_amount?: number | null;
  payment_description_reference?: string | null;
}

interface BankStatementSplitViewProps {
  transactions: Transaction[];
  onConfirm: (transactionId: string) => Promise<void>;
  onEditCategory?: (transactionId: string, category: string) => Promise<void>;
  onEditingChange?: (isEditing: boolean) => void;
  formatDescription?: (tx: Transaction) => string;
}

const CATEGORY_OPTIONS = [
  "Income",
  "Sales",
  "Refund",
  "Transfer In",
  "Cost of Goods Sold",
  "Operating Expenses",
  "Payroll",
  "Rent",
  "Utilities",
  "Insurance",
  "Professional Services",
  "Office Supplies",
  "Travel",
  "Meals & Entertainment",
  "Marketing",
  "Software & Subscriptions",
  "Bank Fees",
  "Interest Expense",
  "Taxes",
  "Equipment",
  "Transfer Out",
  "Owner Draw",
  "Loan Payment",
  "Other Expense",
  "Uncategorized",
];

export default function BankStatementSplitView({
  transactions,
  onConfirm,
  onEditCategory,
  onEditingChange,
  formatDescription,
}: BankStatementSplitViewProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(
    transactions[0]?.id || null
  );
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editCategory, setEditCategory] = React.useState<string>("");

  React.useEffect(() => {
    if (!selectedId && transactions[0]?.id) {
      setSelectedId(transactions[0].id);
    }
  }, [selectedId, transactions]);

  React.useEffect(() => {
    onEditingChange?.(editingId !== null);
  }, [editingId, onEditingChange]);

  const selectedTx = transactions.find((t) => t.id === selectedId) || transactions[0];

  const formatAmount = (tx: Transaction) => {
    const isDebit = tx.is_debit ?? tx.amount < 0;
    const absAmount = Math.abs(tx.amount);
    const formatted = absAmount.toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${isDebit ? "-" : ""}£${formatted}`;
  };

  const startEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditCategory(tx.category || "Uncategorized");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCategory("");
  };

  const saveEdit = async (transactionId: string) => {
    if (onEditCategory && editCategory) {
      await onEditCategory(transactionId, editCategory);
    }
    setEditingId(null);
    setEditCategory("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="max-h-[640px] overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
          {transactions.map((tx) => {
            const isActive = tx.id === selectedTx?.id;
            const isDebit = tx.is_debit ?? tx.amount < 0;
            return (
              <button
                key={tx.id}
                onClick={() => setSelectedId(tx.id)}
                className={`w-full text-left p-4 flex items-center justify-between gap-3 ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                }`}
              >
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {tx.date ? new Date(tx.date).toLocaleDateString("en-GB") : "-"}
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {formatDescription ? formatDescription(tx) : tx.original_description || "-"}
                  </div>
                </div>
                <div
                  className={`text-sm font-semibold ${
                    isDebit ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {formatAmount(tx)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
        {selectedTx ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedTx.date
                    ? new Date(selectedTx.date).toLocaleDateString("en-GB")
                    : "-"}
                </div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatDescription
                    ? formatDescription(selectedTx)
                    : selectedTx.original_description || "-"}
                </div>
                {selectedTx.payment_description_reference && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Ref: {selectedTx.payment_description_reference}
                  </div>
                )}
              </div>
              <div
                className={`text-2xl font-bold ${
                  (selectedTx.is_debit ?? selectedTx.amount < 0)
                    ? "text-red-600 dark:text-red-400"
                    : "text-green-600 dark:text-green-400"
                }`}
              >
                {formatAmount(selectedTx)}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Category</div>
                {editingId === selectedTx.id ? (
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="font-medium">
                    {selectedTx.category || "Uncategorized"}
                    {selectedTx.subcategory && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedTx.subcategory}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Confidence</div>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-16 rounded-full ${
                      selectedTx.confidence_score >= 0.7
                        ? "bg-green-500"
                        : selectedTx.confidence_score >= 0.5
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                  />
                  <span>{Math.round(selectedTx.confidence_score * 100)}%</span>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Status</div>
                <div className="flex items-center gap-2">
                  {selectedTx.user_confirmed ? (
                    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircleIcon className="h-4 w-4" />
                      Confirmed
                    </span>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">Pending</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {editingId === selectedTx.id ? (
                <>
                  <button
                    onClick={() => saveEdit(selectedTx.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
                  >
                    <XMarkIcon className="h-4 w-4" />
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {onEditCategory && (
                    <button
                      onClick={() => startEdit(selectedTx)}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
                    >
                      <PencilIcon className="h-4 w-4" />
                      Edit Category
                    </button>
                  )}
                  {!selectedTx.user_confirmed && (
                    <button
                      onClick={() => onConfirm(selectedTx.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                    >
                      <CheckCircleIcon className="h-4 w-4" />
                      Confirm
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="text-gray-500 dark:text-gray-400">No transaction selected</div>
        )}
      </div>
    </div>
  );
}

