"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export default function HeroSection() {
  return (
    <section className="relative bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-20 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            Automatically Categorize Your
            <span className="text-blue-600 dark:text-blue-400"> Bank Transactions</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
            Upload your bank statements in CSV or Excel format. Our AI-powered system automatically categorizes transactions, saving you hours of manual work.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-lg"
            >
              Get Started Free
              <ArrowRightIcon className="w-5 h-5" />
            </Link>
            <Link
              href="/signin"
              className="inline-flex items-center px-8 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-blue-600 dark:hover:border-blue-400 transition-all duration-200 text-lg"
            >
              Sign In
            </Link>
          </div>
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            No credit card required • Free trial available
          </p>
        </div>
      </div>
    </section>
  );
}

