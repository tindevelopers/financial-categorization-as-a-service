"use client";

import { useParams } from "next/navigation";
import TransactionReview from "@/components/consumer/TransactionReview";

export default function ReviewPage() {
  const params = useParams();
  const jobId = params.jobId as string;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Review Your Transactions
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Review the automatically categorized transactions and make any necessary adjustments before exporting.
          </p>
        </div>
        
        <TransactionReview jobId={jobId} />
      </div>
    </div>
  );
}
