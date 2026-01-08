"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowPathIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

type Direction = "money_in" | "money_out" | "both";

interface CounterpartyRow {
  name: string;
  total_money_in: number;
  total_money_out: number;
  count: number;
  first_date: string | null;
  last_date: string | null;
}

export default function CounterpartiesPage() {
  const [items, setItems] = useState<CounterpartyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction>("both");
  const [q, setQ] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("direction", direction);
      if (q.trim()) params.set("q", q.trim());
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const resp = await fetch(`/api/reports/counterparties?${params.toString()}`);
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to load counterparties");
      }
      setItems(data.items || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load counterparties");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalOut = useMemo(
    () => items.reduce((sum, i) => sum + (i.total_money_out || 0), 0),
    [items]
  );
  const totalIn = useMemo(
    () => items.reduce((sum, i) => sum + (i.total_money_in || 0), 0),
    [items]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Counterparties</h1>
        <p className="text-gray-600 dark:text-gray-400">
          See who you pay and who pays you, with totals and date ranges.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-300">Direction</label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as Direction)}
            className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
          >
            <option value="both">Both</option>
            <option value="money_out">Money Out (payees)</option>
            <option value="money_in">Money In (payors)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-300">Start</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm px-2 py-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-300">End</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm px-2 py-1"
          />
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative w-full">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-2 top-2.5" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search payee or payer"
              className="w-full pl-8 pr-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>
        </div>

        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          disabled={loading}
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Counterparty
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Money Out
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Money In
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Transactions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  First / Last
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {items.map((item) => (
                <tr key={item.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                  <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">
                    {item.name}
                  </td>
                  <td className="px-6 py-3 text-sm text-right text-red-600 dark:text-red-400">
                    £{(item.total_money_out || 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-3 text-sm text-right text-green-600 dark:text-green-400">
                    £{(item.total_money_in || 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">{item.count}</td>
                  <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {item.first_date || "-"} → {item.last_date || "-"}
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    No counterparties found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="py-3 text-center text-sm text-gray-500 dark:text-gray-400">
            Loading...
          </div>
        )}
        {error && (
          <div className="py-3 text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
      </div>

      <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
        <div>
          Total Money Out:{" "}
          <span className="text-red-600 dark:text-red-400">
            £{totalOut.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div>
          Total Money In:{" "}
          <span className="text-green-600 dark:text-green-400">
            £{totalIn.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}

