"use client";

import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function TemplateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const pathname = usePathname();

  // Extract template name from path
  const templateName = pathname.split('/')[2];
  
  // Dynamic class for main content margin based on sidebar state
  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "xl:ml-[290px]"
    : "xl:ml-[90px]";

  return (
    <div className="min-h-screen xl:flex">
      {/* Sidebar and Backdrop */}
      <AppSidebar />
      <Backdrop />
      
      {/* Main Content Area */}
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}
      >
        {/* Header */}
        <AppHeader />
        
        {/* Template Navigation */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/" 
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200"
              >
                ← Back to Templates
              </Link>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300 capitalize">
                {templateName} Dashboard
              </span>
            </div>
            
            {/* Template Switcher */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Switch Template:</span>
              <select 
                value={templateName}
                onChange={(e) => window.location.href = `/templates/${e.target.value}`}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="ecommerce">E-commerce</option>
                <option value="blog-writer">Blog Writer</option>
                <option value="ai-customer-care">AI Customer Care</option>
                <option value="restaurant">Restaurant</option>
                <option value="healthcare">Healthcare</option>
                <option value="finance">Finance</option>
                <option value="education">Education</option>
                <option value="saas">SaaS</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Page Content */}
        <div className="p-4 mx-auto max-w-7xl md:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
