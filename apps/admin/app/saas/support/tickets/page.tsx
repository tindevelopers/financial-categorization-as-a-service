"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { MagnifyingGlassIcon, ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  customer: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in-progress" | "resolved" | "closed";
  assignedTo?: string;
  createdAt: string;
  lastUpdated: string;
}

const tickets: Ticket[] = [
  {
    id: "1",
    ticketNumber: "TKT-2025-001",
    subject: "Unable to access dashboard",
    customer: "Acme Corp",
    category: "Technical Issue",
    priority: "high",
    status: "in-progress",
    assignedTo: "Support Agent 1",
    createdAt: "2025-01-16 10:00 AM",
    lastUpdated: "2025-01-16 11:30 AM",
  },
  {
    id: "2",
    ticketNumber: "TKT-2025-002",
    subject: "Billing question",
    customer: "TechStart Inc",
    category: "Billing",
    priority: "medium",
    status: "open",
    createdAt: "2025-01-16 09:30 AM",
    lastUpdated: "2025-01-16 09:30 AM",
  },
  {
    id: "3",
    ticketNumber: "TKT-2025-003",
    subject: "Feature request: Export data",
    customer: "Global Solutions",
    category: "Feature Request",
    priority: "low",
    status: "resolved",
    assignedTo: "Support Agent 2",
    createdAt: "2025-01-15 02:00 PM",
    lastUpdated: "2025-01-16 08:00 AM",
  },
];

const priorityColors = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-500",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-500",
  urgent: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-500",
};

const statusColors = {
  open: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-500",
  "in-progress": "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-500",
  resolved: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500",
  closed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function SupportTicketsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter] = useState<string>("all");

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(search.toLowerCase()) ||
      ticket.customer.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Support Tickets" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Support Tickets</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Manage and track customer support tickets
            </p>
          </div>
          <Button>
            <ChatBubbleLeftRightIcon className="h-4 w-4" />
            New Ticket
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tickets..."
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            />
          </div>
          <div className="flex gap-2">
            {["all", "open", "in-progress", "resolved", "closed"].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "primary" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Ticket #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Assigned To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {ticket.ticketNumber}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{ticket.subject}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{ticket.customer}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{ticket.category}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityColors[ticket.priority]}`}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[ticket.status]}`}
                      >
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {ticket.assignedTo || "Unassigned"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {ticket.lastUpdated}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

