"use client";

import React, { useEffect, useState } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { createClient } from "@/lib/database/client";

interface Company {
  id: string;
  company_name: string;
}

interface MappingRow {
  id: string;
  category: string;
  subcategory: string | null;
  account_code: string;
}

export default function CategoryMappingPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCompany();
  }, []);

  const loadCompany = async () => {
    try {
      const resp = await fetch("/api/company");
      const data = await resp.json();
      const firstCompany = data?.companies?.[0] || null;
      setCompany(firstCompany);
      if (firstCompany) {
        await loadMappings(firstCompany.id);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load company");
    }
  };

  const loadMappings = async (companyId: string) => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: dbError } = await supabase
      .from("category_account_mapping")
      .select("id, category, subcategory, account_code")
      .eq("company_profile_id", companyId)
      .order("category")
      .order("subcategory", { nullsFirst: true });
    if (dbError) {
      setError(dbError.message);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Category → Account Mapping
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          See how categories map to your chart of accounts for exports and reports.
        </p>
      </div>

      {!company && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          No company found. Please create a company first.
        </div>
      )}

      {company && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadMappings(company.id)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
            disabled={loading}
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      )}

      {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Subcategory
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Account Code
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">
                    {row.category}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {row.subcategory || "—"}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">
                    {row.account_code}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    No mappings found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="py-3 text-center text-sm text-gray-500 dark:text-gray-400">Loading...</div>
        )}
      </div>
    </div>
  );
}

