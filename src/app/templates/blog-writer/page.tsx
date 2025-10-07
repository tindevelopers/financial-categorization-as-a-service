import type { Metadata } from "next";
import React from "react";
import BlogWriterDashboard from "@/components/blog-writer/BlogWriterDashboard";
import BlogWriterMetrics from "@/components/blog-writer/BlogWriterMetrics";
import ContentCalendar from "@/components/blog-writer/ContentCalendar";
import RecentPosts from "@/components/blog-writer/RecentPosts";
import UpcomingSchedule from "@/components/blog-writer/UpcomingSchedule";
import AnalyticsPreview from "@/components/blog-writer/AnalyticsPreview";

export const metadata: Metadata = {
  title: "Blog Writer Admin Panel | TailAdmin Template",
  description: "Content marketing dashboard for small businesses to create, manage, and schedule blog posts with AI-powered writing assistance",
};

export default function BlogWriterTemplate() {
  return (
    <div className="space-y-6">
      {/* Template Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">✍️ Blog Writer Admin Panel</h1>
            <p className="text-indigo-100">
              Content marketing dashboard for small businesses with AI-powered writing assistance
            </p>
          </div>
          <div className="hidden md:block">
            <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">24</div>
              <div className="text-sm text-indigo-100">Posts This Month</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {/* Metrics Cards */}
        <div className="col-span-12">
          <BlogWriterMetrics />
        </div>

        {/* Dashboard Widgets */}
        <div className="col-span-12 xl:col-span-7">
          <BlogWriterDashboard />
        </div>

        {/* Sidebar Widgets */}
        <div className="col-span-12 xl:col-span-5 space-y-6">
          <UpcomingSchedule />
          <AnalyticsPreview />
        </div>

        {/* Content Calendar */}
        <div className="col-span-12">
          <ContentCalendar />
        </div>

        {/* Recent Posts */}
        <div className="col-span-12">
          <RecentPosts />
        </div>
      </div>

      {/* Template Info */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Blog Writer Features
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">AI Blog Generation</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-600 dark:text-purple-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Content Calendar</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600 dark:text-green-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">SEO Optimization</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-orange-600 dark:text-orange-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Analytics Dashboard</span>
          </div>
        </div>
      </div>
    </div>
  );
}
