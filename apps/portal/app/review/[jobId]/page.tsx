import type { Metadata } from "next";
import ConsumerLayout from "@/layout/ConsumerLayout";
import TransactionReview from "@/components/categorization/TransactionReview";

export const metadata: Metadata = {
  title: "Review Transactions | Financial Categorization",
  description: "Review and confirm categorized transactions",
};

export default function ReviewPage({
  params,
}: {
  params: { jobId: string };
}) {
  return (
    <ConsumerLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Review Your Transactions
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Review the automatically categorized transactions and make any necessary adjustments before exporting.
          </p>
        </div>
        
        <TransactionReview jobId={params.jobId} />
      </div>
    </ConsumerLayout>
  );
}
