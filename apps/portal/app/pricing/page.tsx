"use client";

import Link from "next/link";
import { useState } from "react";

type SubscriptionType = "individual" | "company" | "enterprise";

interface PlanOption {
  type: SubscriptionType;
  title: string;
  subtitle: string;
  price: string;
  priceDetail: string;
  features: string[];
  authMethods: string[];
  icon: string;
  popular?: boolean;
  ctaText: string;
}

const plans: PlanOption[] = [
  {
    type: "individual",
    title: "Individual",
    subtitle: "Perfect for personal use",
    price: "Free",
    priceDetail: "to get started",
    features: [
      "Simple OAuth authentication",
      "Platform-managed credentials",
      "Quick setup - no configuration",
      "Up to 1,000 transactions/month",
      "Email support",
    ],
    authMethods: ["OAuth (Platform credentials)"],
    icon: "👤",
    ctaText: "Start Free",
  },
  {
    type: "company",
    title: "Company",
    subtitle: "For growing businesses",
    price: "$49",
    priceDetail: "per month",
    features: [
      "All Individual features",
      "OAuth or Bring Your Own credentials",
      "Company-provided credentials option",
      "Team collaboration (up to 10 users)",
      "Up to 10,000 transactions/month",
      "Priority email support",
    ],
    authMethods: ["OAuth", "Bring Your Own Credentials", "Company Credentials"],
    icon: "🏢",
    popular: true,
    ctaText: "Start Trial",
  },
  {
    type: "enterprise",
    title: "Enterprise",
    subtitle: "Full control & security",
    price: "Custom",
    priceDetail: "contact sales",
    features: [
      "All Company features",
      "Bring Your Own Google credentials (required)",
      "Full control over authentication",
      "Enterprise-grade security & compliance",
      "Unlimited transactions",
      "Unlimited team members",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    authMethods: ["Bring Your Own Credentials (Required)"],
    icon: "🏛️",
    ctaText: "Contact Sales",
  },
];

const faqs = [
  {
    question: "What's the difference between authentication methods?",
    answer:
      "OAuth uses our platform credentials for quick setup. 'Bring Your Own' lets you use your company's Google credentials for full control. Enterprise requires your own credentials for compliance.",
  },
  {
    question: "Can I upgrade or downgrade my plan?",
    answer:
      "Yes! You can upgrade anytime and the change takes effect immediately. Downgrades take effect at the end of your billing cycle.",
  },
  {
    question: "What happens if I exceed my transaction limit?",
    answer:
      "We'll notify you when you're approaching your limit. You can upgrade your plan or purchase additional transactions as needed.",
  },
  {
    question: "Is there a free trial for paid plans?",
    answer:
      "Yes, Company plan includes a 14-day free trial. Enterprise plans include a custom pilot period.",
  },
];

export default function PricingPage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleSelectPlan = (type: SubscriptionType) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("selectedSubscriptionType", type);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">FC</span>
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">
                FinCat
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/signin"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Choose the plan that fits your needs. Start free, upgrade as you grow.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.type}
                className={`relative bg-white dark:bg-gray-800 rounded-2xl border-2 transition-all hover:shadow-xl ${
                  plan.popular
                    ? "border-blue-500 shadow-lg scale-105"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="p-8">
                  <div className="text-4xl mb-4">{plan.icon}</div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {plan.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {plan.subtitle}
                  </p>

                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      {plan.price}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                      {plan.priceDetail}
                    </span>
                  </div>

                  <Link
                    href="/signup"
                    onClick={() => handleSelectPlan(plan.type)}
                    className={`block w-full py-3 px-4 rounded-lg font-medium text-center transition-colors ${
                      plan.popular
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    {plan.ctaText}
                  </Link>

                  <div className="mt-8">
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                      What&apos;s included:
                    </p>
                    <ul className="space-y-3">
                      {plan.features.map((feature, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400"
                        >
                          <svg
                            className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Authentication:
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
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between"
                >
                  <span className="font-medium text-gray-900 dark:text-white">
                    {faq.question}
                  </span>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${
                      expandedFaq === idx ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {expandedFaq === idx && (
                  <div className="px-6 pb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Ready to get started?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Join thousands of businesses automating their financial categorization.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Start Your Free Account
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              &copy; {new Date().getFullYear()} FinCat. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link
                href="/terms"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Terms
              </Link>
              <Link
                href="/privacy"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Privacy
              </Link>
              <Link
                href="/contact"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

