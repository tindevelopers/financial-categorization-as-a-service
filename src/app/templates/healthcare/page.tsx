import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Healthcare Dashboard | TailAdmin Template",
  description: "Medical practice management dashboard template with patients, appointments, records, and billing",
};

export default function HealthcareTemplate() {
  return (
    <div className="space-y-6">
      {/* Template Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">🏥 Healthcare Dashboard</h1>
            <p className="text-green-100">
              Medical practice management with patients, appointments, records, and billing
            </p>
          </div>
          <div className="hidden md:block">
            <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">156</div>
              <div className="text-sm text-green-100">Active Patients</div>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-24 h-24 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🏥</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Healthcare Template Coming Soon
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            We&apos;re developing a comprehensive healthcare management system with patient records, 
            appointment scheduling, medical billing, and staff management.
          </p>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
              Planned Features:
            </h3>
            <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
              <li>• Patient Records Management</li>
              <li>• Appointment Scheduling</li>
              <li>• Medical Billing System</li>
              <li>• Staff Management</li>
              <li>• Prescription Tracking</li>
              <li>• Insurance Management</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
