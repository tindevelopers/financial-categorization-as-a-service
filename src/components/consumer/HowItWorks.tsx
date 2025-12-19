"use client";

import {
  DocumentArrowUpIcon,
  SparklesIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

const steps = [
  {
    number: "1",
    icon: DocumentArrowUpIcon,
    title: "Upload Your File",
    description: "Upload your bank statement in CSV, XLS, or XLSX format. Our system supports all major bank export formats.",
  },
  {
    number: "2",
    icon: SparklesIcon,
    title: "Automatic Categorization",
    description: "Our AI analyzes each transaction and automatically assigns categories based on merchant names, descriptions, and patterns.",
  },
  {
    number: "3",
    icon: ChartBarIcon,
    title: "Review & Export",
    description: "Review the categorized transactions, make adjustments if needed, and export to your preferred format.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Three simple steps to get your transactions categorized
          </p>
        </div>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 transform translate-x-4" />
                )}
                <div className="relative bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-200 border border-gray-200 dark:border-gray-700">
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl shadow-lg">
                    {step.number}
                  </div>
                  <div className="mt-6 mb-4 flex justify-center">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <step.icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 text-center">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-center">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

