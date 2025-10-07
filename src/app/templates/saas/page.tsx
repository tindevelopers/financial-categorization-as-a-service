import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "SaaS Dashboard | TailAdmin Template",
  description: "Software-as-a-Service dashboard template with users, subscriptions, analytics, and billing",
};

export default function SaasTemplate() {
  return (
    <div className="space-y-6">
      {/* Template Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">💼 SaaS Dashboard</h1>
            <p className="text-indigo-100">
              Software-as-a-Service dashboard with users, subscriptions, analytics, and billing
            </p>
          </div>
          <div className="hidden md:block">
            <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">8,942</div>
              <div className="text-sm text-indigo-100">Active Users</div>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">💼</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            SaaS Template Coming Soon
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            We&apos;re developing a comprehensive SaaS management system with user management, 
            subscription plans, usage analytics, and billing integration.
          </p>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
            <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 mb-2">
              Planned Features:
            </h3>
            <ul className="text-sm text-indigo-800 dark:text-indigo-200 space-y-1">
              <li>• User Management</li>
              <li>• Subscription Plans</li>
              <li>• Usage Analytics</li>
              <li>• Billing System</li>
              <li>• Feature Flags</li>
              <li>• API Management</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
