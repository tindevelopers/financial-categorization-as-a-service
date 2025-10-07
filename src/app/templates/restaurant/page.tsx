import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Restaurant Dashboard | TailAdmin Template",
  description: "Restaurant management dashboard template with menu, orders, inventory, and staff management",
};

export default function RestaurantTemplate() {
  return (
    <div className="space-y-6">
      {/* Template Header */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">🍽️ Restaurant Dashboard</h1>
            <p className="text-orange-100">
              Restaurant management system with menu, orders, inventory, and staff management
            </p>
          </div>
          <div className="hidden md:block">
            <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">$18,450</div>
              <div className="text-sm text-orange-100">Daily Revenue</div>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-24 h-24 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🍽️</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Restaurant Template Coming Soon
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            We&apos;re working on a comprehensive restaurant management dashboard with menu management, 
            order processing, inventory tracking, and staff scheduling.
          </p>
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
            <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
              Planned Features:
            </h3>
            <ul className="text-sm text-orange-800 dark:text-orange-200 space-y-1">
              <li>• Menu Management System</li>
              <li>• Order Processing & Tracking</li>
              <li>• Inventory Management</li>
              <li>• Staff Scheduling</li>
              <li>• Revenue Analytics</li>
              <li>• Customer Management</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
