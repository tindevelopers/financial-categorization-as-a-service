import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Finance Dashboard | TailAdmin Template",
  description: "Financial dashboard template with transactions, accounts, reports, and budgeting tools",
};

export default function FinanceTemplate() {
  return (
    <div className="space-y-6">
      {/* Template Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">💰 Finance Dashboard</h1>
            <p className="text-purple-100">
              Financial dashboard with transactions, accounts, reports, and budgeting tools
            </p>
          </div>
          <div className="hidden md:block">
            <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">$2.4M</div>
              <div className="text-sm text-purple-100">Total Assets</div>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-24 h-24 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">💰</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Finance Template Coming Soon
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            We&apos;re building a comprehensive financial management system with transaction tracking, 
            account management, financial reporting, and budgeting tools.
          </p>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
              Planned Features:
            </h3>
            <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1">
              <li>• Transaction Management</li>
              <li>• Account Overview</li>
              <li>• Financial Reports</li>
              <li>• Budget Planning</li>
              <li>• Investment Tracking</li>
              <li>• Tax Management</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
