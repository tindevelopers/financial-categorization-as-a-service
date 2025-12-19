import type { Metadata } from "next";
import ConsumerLayout from "@/layout/ConsumerLayout";

export const metadata: Metadata = {
  title: "SaaS Platform - Welcome",
  description: "Welcome to our SaaS platform",
};

import Link from "next/link";
import { ArrowUpTrayIcon, DocumentCheckIcon, ChartBarIcon } from "@heroicons/react/24/outline";

export default function HomePage() {
  return (
    <ConsumerLayout>
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Categorize Your Financial Transactions
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Upload your spreadsheet and let AI automatically categorize your transactions. 
            Review, adjust, and export to Google Sheets for your accountant.
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-semibold transition-colors"
          >
            <ArrowUpTrayIcon className="h-6 w-6" />
            Upload Spreadsheet
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg mb-4">
              <ArrowUpTrayIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Upload Spreadsheet
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Upload your Excel or CSV file with transactions. We support .xlsx, .xls, and .csv formats.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg mb-4">
              <DocumentCheckIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Auto-Categorize
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Our AI automatically categorizes your transactions using smart pattern matching and your preferences.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg mb-4">
              <ChartBarIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Export to Google Sheets
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Review your categorized transactions and export directly to Google Sheets for your accountant.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-16 bg-gray-50 dark:bg-gray-900 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                1
              </div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">Upload</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Upload your spreadsheet</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                2
              </div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">Process</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">We extract and categorize</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                3
              </div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">Review</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Review and adjust categories</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                4
              </div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">Export</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Export to Google Sheets</p>
            </div>
          </div>
        </div>
      </div>
    </ConsumerLayout>
  );
}

