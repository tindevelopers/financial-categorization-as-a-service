"use client";

import React, { useEffect, useState } from "react";
import { ArrowPathIcon, PlusCircleIcon } from "@heroicons/react/24/outline";
import { createClient } from "@/lib/database/client";

interface Company {
  id: string;
  company_name: string;
}

interface Account {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  is_active: boolean;
}

export default function ChartOfAccountsPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);

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
        await loadAccounts(firstCompany.id);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load company");
    }
  };

  const loadAccounts = async (companyId: string) => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: dbError } = await supabase
      .from("chart_of_accounts")
      .select("id, account_code, account_name, account_type, is_active")
      .eq("company_profile_id", companyId)
      .order("account_code");
    if (dbError) {
      setError(dbError.message);
    } else {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  const ensureDefaults = async () => {
    if (!company) return;
    setInitializing(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("create_default_uk_chart_of_accounts", {
      p_company_profile_id: company.id,
    });
    if (rpcError) {
      setError(rpcError.message);
    }
    await loadAccounts(company.id);
    setInitializing(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Chart of Accounts</h1>
        <p className="text-gray-600 dark:text-gray-400">
          View and initialize your company’s chart of accounts.
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
            onClick={() => loadAccounts(company.id)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
            disabled={loading}
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={ensureDefaults}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            disabled={initializing}
          >
            <PlusCircleIcon className="h-4 w-4" />
            {initializing ? "Creating..." : "Create default UK CoA"}
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
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {accounts.map((acc) => (
                <tr key={acc.id}>
                  <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">
                    {acc.account_code}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">
                    {acc.account_name}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {acc.account_type}
                  </td>
                  <td className="px-6 py-3 text-sm">
                    {acc.is_active ? (
                      <span className="text-green-600 dark:text-green-400">Active</span>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">Inactive</span>
                    )}
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    No accounts yet.
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

