"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"
import TransactionReview from "@/components/consumer/TransactionReview"

export default function ReviewJobPage() {
  const params = useParams()
  const jobId = params.jobId as string

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/review"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Jobs
        </Link>
      </div>

      <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Review Your Transactions
        </h1>
          <p className="text-gray-600 dark:text-gray-300">
          Review the automatically categorized transactions and make any necessary adjustments before exporting.
            Choose your preferred view: Card Grid, Split View, or Expanded Table.
        </p>
      </div>

      <TransactionReview jobId={jobId} />
      </div>
    </div>
  )
}

