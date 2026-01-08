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

interface BankStatementCardViewProps {
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

export default function BankStatementCardView({
  transactions,
  onConfirm,
  onEditCategory,
  onEditingChange,
  formatDescription,
}: BankStatementCardViewProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editCategory, setEditCategory] = React.useState<string>("");

  React.useEffect(() => {
    onEditingChange?.(editingId !== null);
  }, [editingId, onEditingChange]);

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

  const formatAmount = (tx: Transaction) => {
    const isDebit = tx.is_debit ?? tx.amount < 0;
    const absAmount = Math.abs(tx.amount);
    const formatted = absAmount.toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${isDebit ? "-" : ""}£${formatted}`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {transactions.map((tx) => {
        const isEditing = editingId === tx.id;
        const confidence = Math.round(tx.confidence_score * 100);

        return (
          <div
            key={tx.id}
            className={`border rounded-lg p-4 shadow-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 space-y-3 ${
              tx.user_confirmed ? "ring-1 ring-green-400/60" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {tx.date ? new Date(tx.date).toLocaleDateString("en-GB") : "-"}
                </div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {formatDescription ? formatDescription(tx) : tx.original_description || "-"}
                </div>
                {tx.payment_description_reference && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Ref: {tx.payment_description_reference}
                  </div>
                )}
              </div>
              <div
                className={`text-lg font-semibold ${
                  (tx.is_debit ?? tx.amount < 0)
                    ? "text-red-600 dark:text-red-400"
                    : "text-green-600 dark:text-green-400"
                }`}
              >
                {formatAmount(tx)}
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="space-y-1">
                <div className="font-medium">
                  {isEditing ? (
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                    >
                      {CATEGORY_OPTIONS.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  ) : (
                    tx.category || "Uncategorized"
                  )}
                </div>
                {tx.subcategory && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">{tx.subcategory}</div>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <div
                  className={`h-2 w-14 rounded-full ${
                    tx.confidence_score >= 0.7
                      ? "bg-green-500"
                      : tx.confidence_score >= 0.5
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                />
                <span>{confidence}%</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {tx.user_confirmed ? (
                  <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircleIcon className="h-4 w-4" />
                    Confirmed
                  </span>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">Pending</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => saveEdit(tx.id)}
                      className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                      title="Save"
                    >
                      <CheckCircleIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-1.5 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title="Cancel"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    {onEditCategory && (
                      <button
                        onClick={() => startEdit(tx)}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        title="Edit Category"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    )}
                    {!tx.user_confirmed && (
                      <button
                        onClick={() => onConfirm(tx.id)}
                        className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                        title="Confirm"
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

