import type { Metadata } from "next";
import ConsumerLayout from "@/layout/ConsumerLayout";
import SpreadsheetUpload from "@/components/categorization/SpreadsheetUpload";

export const metadata: Metadata = {
  title: "Upload Spreadsheet | Financial Categorization",
  description: "Upload your financial spreadsheet to automatically categorize transactions",
};

export default function UploadPage() {
  return (
    <ConsumerLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Upload Your Spreadsheet
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Upload your financial spreadsheet (.xlsx, .xls, or .csv) and we'll automatically categorize your transactions.
          </p>
        </div>
        
        <SpreadsheetUpload />
      </div>
    </ConsumerLayout>
  );
}
