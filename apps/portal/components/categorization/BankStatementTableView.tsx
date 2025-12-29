"use client";

import React, { useState } from "react";
import {
  CheckCircleIcon,
  PencilIcon,
  XMarkIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";

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
  transaction_type?: string | null;
  is_debit?: boolean | null;
  running_balance?: number | null;
  group_transaction_ids?: string[];
}

interface BankStatementTableViewProps {
  transactions: Transaction[];
  onConfirm: (transactionId: string) => Promise<void>;
  onEditCategory?: (transactionId: string, category: string) => Promise<void>;
  onEditingChange?: (isEditing: boolean) => void;
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

export default function BankStatementTableView({
  transactions,
  onConfirm,
  onEditCategory,
  onEditingChange,
}: BankStatementTableViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState<string>("");

  // Notify parent when editing state changes
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

  const formatAmount = (amount: number, isDebit?: boolean | null) => {
    const absAmount = Math.abs(amount);
    const formatted = absAmount.toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    // If isDebit is explicitly set, use it; otherwise infer from amount sign
    const showAsDebit = isDebit !== null && isDebit !== undefined ? isDebit : amount < 0;
    return showAsDebit ? `-£${formatted}` : `£${formatted}`;
  };

  const getAmountColor = (amount: number, isDebit?: boolean | null) => {
    const showAsDebit = isDebit !== null && isDebit !== undefined ? isDebit : amount < 0;
    return showAsDebit
      ? "text-red-600 dark:text-red-400"
      : "text-green-600 dark:text-green-400";
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No transactions found
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Confidence
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {transactions.map((tx) => {
              const isEditing = editingId === tx.id;

              return (
                <tr
                  key={tx.id}
                  className={`${
                    tx.user_confirmed
                      ? "bg-green-50 dark:bg-green-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  } transition-colors`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {tx.date
                      ? new Date(tx.date).toLocaleDateString("en-GB")
                      : "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-md">
                    <div className="truncate" title={tx.original_description}>
                      {tx.original_description || "-"}
                    </div>
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${getAmountColor(
                      tx.amount,
                      tx.is_debit
                    )}`}
                  >
                    {formatAmount(tx.amount, tx.is_debit)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {isEditing ? (
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      >
                        {CATEGORY_OPTIONS.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div>
                        <div className="font-medium">
                          {tx.category || "Uncategorized"}
                        </div>
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    {tx.user_confirmed ? (
                      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                        <CheckCircleIcon className="h-4 w-4" />
                        Confirmed
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(tx.id)}
                            className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                            title="Save"
                          >
                            <CheckIcon className="h-4 w-4" />
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

