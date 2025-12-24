"use client"

import { useParams } from "next/navigation"
import TransactionReview from "@/components/categorization/TransactionReview"

export default function ReviewJobDetailPage() {
  const params = useParams()
  const jobId = params.jobId as string

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Review Your Transactions
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Review the automatically categorized transactions and make any necessary adjustments before exporting.
        </p>
      </div>
      
      <TransactionReview jobId={jobId} />
    </div>
  )
}

