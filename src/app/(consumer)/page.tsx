import type { Metadata } from "next";
import HeroSection from "@/components/consumer/HeroSection";
import FeaturesSection from "@/components/consumer/FeaturesSection";
import HowItWorks from "@/components/consumer/HowItWorks";
import PricingSection from "@/components/consumer/PricingSection";
import CTASection from "@/components/consumer/CTASection";

export const metadata: Metadata = {
  title: "Financial Categorization Service - Automatically Categorize Bank Transactions",
  description: "Upload your bank statements in CSV or Excel format. Our AI-powered system automatically categorizes transactions, saving you hours of manual work.",
  keywords: "bank statement categorization, transaction categorization, CSV categorization, Excel categorization, financial automation",
  openGraph: {
    title: "Financial Categorization Service - Automatically Categorize Bank Transactions",
    description: "AI-powered transaction categorization for bank statements. Support for CSV, XLS, and XLSX formats.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <HowItWorks />
      <PricingSection />
      <CTASection />
    </>
  );
}
