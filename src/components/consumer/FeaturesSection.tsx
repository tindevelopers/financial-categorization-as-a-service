"use client";

import {
  DocumentArrowUpIcon,
  SparklesIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  ClockIcon,
  CloudArrowUpIcon,
} from "@heroicons/react/24/outline";

const features = [
  {
    icon: DocumentArrowUpIcon,
    title: "Multiple File Formats",
    description: "Support for CSV, XLS, and XLSX files. Export directly from your bank or accounting software.",
  },
  {
    icon: SparklesIcon,
    title: "AI-Powered Categorization",
    description: "Our intelligent system automatically categorizes transactions using machine learning algorithms.",
  },
  {
    icon: ChartBarIcon,
    title: "Detailed Analytics",
    description: "Get insights into your spending patterns with comprehensive reports and visualizations.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Secure & Private",
    description: "Your financial data is encrypted and stored securely. We never share your information.",
  },
  {
    icon: ClockIcon,
    title: "Save Time",
    description: "Process months of transactions in minutes instead of hours of manual categorization.",
  },
  {
    icon: CloudArrowUpIcon,
    title: "Easy Export",
    description: "Export categorized data back to Excel, CSV, or integrate with your accounting software.",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-20 bg-white dark:bg-gray-800">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Everything You Need
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Powerful features to streamline your financial categorization workflow
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-200 hover:shadow-lg"
            >
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

