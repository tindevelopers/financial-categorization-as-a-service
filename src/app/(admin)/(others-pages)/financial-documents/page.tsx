import { Metadata } from "next";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { DocumentBrowser } from "@/components/documents";

export const metadata: Metadata = {
  title: "Financial Documents | Document Management",
  description: "Upload and manage bank statements, receipts, invoices, and tax documents",
};

export default function FinancialDocumentsPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Financial Documents" />
      <DocumentBrowser />
    </div>
  );
}

