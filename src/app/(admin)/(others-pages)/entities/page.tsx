import { Metadata } from "next";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { EntityList } from "@/components/entities";

export const metadata: Metadata = {
  title: "Entities | Financial Document Management",
  description: "Manage persons and businesses for document organization",
};

export default function EntitiesPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Entities" />
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <EntityList />
      </div>
    </div>
  );
}

