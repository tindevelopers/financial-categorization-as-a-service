"use client";

import { useParams } from "next/navigation";
import TransactionReview from "@/components/consumer/TransactionReview";

export default function ReviewPage() {
  const params = useParams();
  const jobId = params.jobId as string;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
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
  );
}
