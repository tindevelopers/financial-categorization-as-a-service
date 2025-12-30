"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/button/Button";
import { CheckCircleIcon, ArrowRightIcon } from "@/icons";
import type { SubscriptionType } from "@/app/actions/subscription";

interface PlanOption {
  type: SubscriptionType;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  authMethods: string[];
  price: string;
  priceNote?: string;
  targetAudience: string;
  popular?: boolean;
  icon: string;
  color: string;
}

const plans: PlanOption[] = [
  {
    type: "individual",
    title: "Individual",
    subtitle: "Quick Start",
    description: "Get started instantly with OAuth. Perfect for freelancers and personal projects.",
    targetAudience: "Freelancers, consultants, personal finance tracking",
    features: [
      "Instant OAuth setup",
      "Platform-managed credentials",
      "Automatic transaction categorization",
      "Export to CSV/Excel",
      "Up to 1,000 transactions/month",
    ],
    authMethods: ["Google OAuth"],
    price: "Free",
    priceNote: "No credit card required",
    popular: true,
    icon: "👤",
    color: "blue",
  },
  {
    type: "company",
    title: "Company",
    subtitle: "Team Ready",
    description: "Flexible authentication for growing businesses. Use your own credentials or ours.",
    targetAudience: "Small businesses, accounting teams, finance departments",
    features: [
      "All Individual features",
      "Bring your own Google credentials",
      "Company-wide credential sharing",
      "Team collaboration",
      "Up to 10,000 transactions/month",
      "Priority support",
    ],
    authMethods: ["Google OAuth", "Custom OAuth", "Company Credentials"],
    price: "$29",
    priceNote: "per month",
    icon: "🏢",
    color: "green",
  },
  {
    type: "enterprise",
    title: "Enterprise",
    subtitle: "Full Control",
    description: "Enterprise-grade security with complete control over your authentication.",
    targetAudience: "Large organizations, financial institutions, regulated industries",
    features: [
      "All Company features",
      "Mandatory custom credentials",
      "SSO integration",
      "Audit logs",
      "Unlimited transactions",
      "Dedicated account manager",
      "Custom integrations",
    ],
    authMethods: ["Custom OAuth (Required)", "Service Account"],
    price: "Custom",
    priceNote: "Contact sales",
    icon: "🏛️",
    color: "purple",
  },
];

const faqs = [
  {
    question: "Can I change my plan later?",
    answer: "Yes! You can upgrade from Individual to Company at any time with a single click. Upgrading to Enterprise requires setting up your own Google credentials first.",
  },
  {
    question: "What's the difference between OAuth and custom credentials?",
    answer: "OAuth uses our platform's Google integration for quick setup. Custom credentials let you use your own Google Cloud project, giving you full control over API quotas and data access.",
  },
  {
    question: "Do I need technical knowledge for Enterprise?",
    answer: "Enterprise requires setting up a Google Cloud project and service account. We provide detailed guides and our support team can help you through the process.",
  },
  {
    question: "Is my financial data secure?",
    answer: "Absolutely. We use bank-level encryption, never store your bank credentials, and are SOC 2 Type II compliant. Enterprise customers get additional security features.",
  },
];

const stats = [
  { value: "50K+", label: "Transactions Categorized" },
  { value: "99.9%", label: "Accuracy Rate" },
  { value: "500+", label: "Happy Users" },
  { value: "24/7", label: "Support" },
];

export default function ChoosePlanPage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionType | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleContinue = () => {
    if (selectedPlan) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("selectedSubscriptionType", selectedPlan);
      }
      router.push("/signup");
    }
  };

  const handleSelectPlan = (plan: SubscriptionType) => {
    setSelectedPlan(plan);
  };

  const getColorClasses = (color: string, isSelected: boolean) => {
    const colors: Record<string, { border: string; bg: string; text: string; badge: string }> = {
      blue: {
        border: isSelected ? "border-blue-500" : "border-gray-200 dark:border-gray-700",
        bg: isSelected ? "bg-blue-50 dark:bg-blue-900/20" : "bg-white dark:bg-gray-800",
        text: "text-blue-600 dark:text-blue-400",
        badge: "bg-blue-600",
      },
      green: {
        border: isSelected ? "border-emerald-500" : "border-gray-200 dark:border-gray-700",
        bg: isSelected ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-white dark:bg-gray-800",
        text: "text-emerald-600 dark:text-emerald-400",
        badge: "bg-emerald-600",
      },
      purple: {
        border: isSelected ? "border-purple-500" : "border-gray-200 dark:border-gray-700",
        bg: isSelected ? "bg-purple-50 dark:bg-purple-900/20" : "bg-white dark:bg-gray-800",
        text: "text-purple-600 dark:text-purple-400",
        badge: "bg-purple-600",
      },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-emerald-600/10 dark:from-blue-600/5 dark:via-purple-600/5 dark:to-emerald-600/5" />
        <div className="relative container mx-auto px-4 pt-16 pb-12">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-700 dark:text-blue-300 text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Join 500+ users automating their finances
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              Automate Your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600">
                Financial Categorization
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
              Upload bank statements, get AI-powered transaction categorization in seconds.
              Choose the plan that fits your needs.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mt-8">
            {stats.map((stat, idx) => (
              <div
                key={idx}
                className="text-center p-4 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-gray-700/50"
              >
                <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plan Selection */}
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Choose Your Plan
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Start free, upgrade when you need more. All plans include core categorization features.
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid gap-6 lg:grid-cols-3 max-w-6xl mx-auto mb-12">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.type;
            const colors = getColorClasses(plan.color, isSelected);

            return (
              <div
                key={plan.type}
                onClick={() => setSelectedPlan(plan.type)}
                className={`relative cursor-pointer rounded-2xl border-2 p-6 transition-all duration-300 ${colors.border} ${colors.bg} ${
                  isSelected ? "shadow-xl scale-[1.02]" : "hover:shadow-lg hover:scale-[1.01]"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className={`${colors.badge} text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg`}>
                      MOST POPULAR
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-6 pt-2">
                  <div className="text-5xl mb-3">{plan.icon}</div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{plan.title}</h3>
                  <p className={`text-sm font-medium ${colors.text}`}>{plan.subtitle}</p>
                </div>

                {/* Pricing */}
                <div className="text-center mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">{plan.price}</span>
                    {plan.priceNote && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">/{plan.priceNote}</span>
                    )}
                  </div>
                </div>

                {/* Target Audience */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                    Best for: {plan.targetAudience}
                  </p>
                </div>

                {/* Features */}
                <div className="space-y-3 mb-6">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Auth Methods */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Authentication
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {plan.authMethods.map((method, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                      >
                        {method}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Selection Indicator */}
                {isSelected && (
                  <div className="absolute top-4 right-4">
                    <div className={`w-6 h-6 rounded-full ${colors.badge} flex items-center justify-center`}>
                      <CheckCircleIcon className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}

                {/* Enterprise Warning */}
                {plan.type === "enterprise" && (
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-700 dark:text-amber-400 text-center">
                      Requires Google Cloud credentials setup
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CTA Section */}
        <div className="max-w-xl mx-auto text-center mb-16">
          <Button
            onClick={handleContinue}
            disabled={!selectedPlan}
            className="w-full sm:w-auto px-8 py-4 text-lg"
            size="lg"
          >
            {selectedPlan ? (
              <>
                Continue with {plans.find((p) => p.type === selectedPlan)?.title}
                <ArrowRightIcon className="w-5 h-5 ml-2" />
              </>
            ) : (
              "Select a Plan to Continue"
            )}
          </Button>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{" "}
            <Link href="/signin" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Frequently Asked Questions
          </h3>
          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <span className="font-medium text-gray-900 dark:text-white">{faq.question}</span>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                      expandedFaq === idx ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedFaq === idx && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-600 dark:text-gray-400">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Trusted & Secure</p>
          <div className="flex items-center justify-center gap-8 opacity-60">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">256-bit Encryption</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">SOC 2 Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
              </svg>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">GDPR Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
