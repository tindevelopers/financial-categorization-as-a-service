import type { Metadata } from "next";
import TemplateGrid from "@/components/landing/TemplateGrid";
import HeroSection from "@/components/landing/HeroSection";
import QuickStart from "@/components/landing/QuickStart";

export const metadata: Metadata = {
  title: "SaaS Admin - Modern Admin Dashboard Templates",
  description: "Choose from industry-specific admin dashboard templates built with Next.js 15 and Tailwind CSS. E-commerce, Healthcare, Finance, Education, SaaS and more.",
  keywords: "admin dashboard, template, Next.js, Tailwind CSS, e-commerce, healthcare, finance, SaaS",
  openGraph: {
    title: "SaaS Admin - Modern Admin Dashboard Templates",
    description: "Industry-specific admin dashboard templates for modern web applications",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <HeroSection />
      
      {/* Template Grid */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your Template
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Select from our collection of industry-specific admin dashboard templates. 
            Each template is fully customizable and ready for production.
          </p>
        </div>
        
        <TemplateGrid />
      </div>
      
      {/* Quick Start Section */}
      <QuickStart />
    </div>
  );
}
