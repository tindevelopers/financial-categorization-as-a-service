import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Education Dashboard | TailAdmin Template",
  description: "Educational institution management dashboard template with students, courses, grades, and attendance",
};

export default function EducationTemplate() {
  return (
    <div className="space-y-6">
      {/* Template Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">🎓 Education Dashboard</h1>
            <p className="text-red-100">
              Educational institution management with students, courses, grades, and attendance
            </p>
          </div>
          <div className="hidden md:block">
            <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">1,247</div>
              <div className="text-sm text-red-100">Active Students</div>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-24 h-24 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🎓</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Education Template Coming Soon
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            We&apos;re creating a comprehensive educational management system with student records, 
            course scheduling, grade management, and attendance tracking.
          </p>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
            <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">
              Planned Features:
            </h3>
            <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
              <li>• Student Management</li>
              <li>• Course Scheduling</li>
              <li>• Grade Tracking</li>
              <li>• Attendance Reports</li>
              <li>• Teacher Management</li>
              <li>• Parent Portal</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
