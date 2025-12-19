import type { Metadata } from "next";
import ConsumerLayout from "@/layout/ConsumerLayout";
import InvoiceUpload from "@/components/categorization/InvoiceUpload";

export const metadata: Metadata = {
  title: "Upload Invoices | Financial Categorization",
  description: "Upload invoice images to automatically extract and categorize transactions",
};

export default function InvoiceUploadPage() {
  return (
    <ConsumerLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Upload Your Invoices
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Upload invoice images (.jpg, .png, .pdf) and we'll automatically extract transaction data and categorize them.
          </p>
        </div>
        
        <InvoiceUpload />
      </div>
    </ConsumerLayout>
  );
}
