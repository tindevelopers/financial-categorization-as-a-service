"use client";

import GridShape from "@/components/common/GridShape";
import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";
import { ThemeProvider } from "@/context/ThemeContext";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { CheckCircleIcon } from "@/icons";

interface PlanInfo {
  type: string;
  title: string;
  description: string;
  features: string[];
  icon: string;
  color: string;
}

const planDetails: Record<string, PlanInfo> = {
  individual: {
    type: "individual",
    title: "Individual Plan",
    description: "Quick setup with OAuth. Perfect for personal use.",
    features: [
      "Instant Google OAuth setup",
      "AI-powered categorization",
      "Export to CSV/Excel",
      "Up to 1,000 transactions/month",
    ],
    icon: "👤",
    color: "blue",
  },
  company: {
    type: "company",
    title: "Company Plan",
    description: "Flexible authentication for your team.",
    features: [
      "All Individual features",
      "Bring your own credentials",
      "Team collaboration",
      "Up to 10,000 transactions/month",
    ],
    icon: "🏢",
    color: "emerald",
  },
  enterprise: {
    type: "enterprise",
    title: "Enterprise Plan",
    description: "Full control with enterprise-grade security.",
    features: [
      "All Company features",
      "Custom credential management",
      "SSO integration",
      "Unlimited transactions",
    ],
    icon: "🏛️",
    color: "purple",
  },
};

const testimonials = [
  {
    quote: "Saved us 10+ hours every month on transaction categorization.",
    author: "Sarah M.",
    role: "Financial Analyst",
  },
  {
    quote: "The AI accuracy is incredible. It learns our categories perfectly.",
    author: "James K.",
    role: "Small Business Owner",
  },
  {
    quote: "Finally, a tool that understands our accounting needs.",
    author: "Lisa T.",
    role: "Bookkeeper",
  },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [testimonialIndex, setTestimonialIndex] = useState(0);

  useEffect(() => {
    // Check for pre-selected plan
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("selectedSubscriptionType");
      if (stored && ["individual", "company", "enterprise"].includes(stored)) {
        setSelectedPlan(stored);
      }
    }

    // Rotate testimonials
    const interval = setInterval(() => {
      setTestimonialIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const planInfo = selectedPlan ? planDetails[selectedPlan] : null;
  const currentTestimonial = testimonials[testimonialIndex];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      blue: {
        bg: "bg-blue-500/10",
        text: "text-blue-400",
        border: "border-blue-500/30",
      },
      emerald: {
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        border: "border-emerald-500/30",
      },
      purple: {
        bg: "bg-purple-500/10",
        text: "text-purple-400",
        border: "border-purple-500/30",
      },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <ThemeProvider>
        <div className="relative flex lg:flex-row w-full min-h-screen justify-center flex-col dark:bg-gray-900 sm:p-0">
          {children}
          <div className="lg:w-1/2 w-full bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 lg:flex flex-col items-center justify-center hidden relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0">
              <GridShape />
            </div>
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-slate-900/50" />

            <div className="relative z-10 flex flex-col items-center justify-center h-full p-12 max-w-lg">
              {/* Logo */}
              <Link href="/" className="block mb-8">
                <Image
                  width={180}
                  height={40}
                  src="/images/logo/auth-logo.svg"
                  alt="Logo"
                  className="opacity-90"
                />
              </Link>

              {/* Dynamic Plan Info or Default Content */}
              {planInfo ? (
                <div className={`w-full p-6 rounded-2xl border ${getColorClasses(planInfo.color).border} ${getColorClasses(planInfo.color).bg} backdrop-blur-sm mb-8`}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">{planInfo.icon}</span>
                    <div>
                      <h3 className="text-xl font-bold text-white">{planInfo.title}</h3>
                      <p className={`text-sm ${getColorClasses(planInfo.color).text}`}>
                        {planInfo.description}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {planInfo.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <CheckCircleIcon className={`w-4 h-4 ${getColorClasses(planInfo.color).text}`} />
                        <span className="text-sm text-gray-300">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <Link
                      href="/pricing"
                      className={`text-sm ${getColorClasses(planInfo.color).text} hover:underline`}
                    >
                      Change plan →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-white mb-4">
                    Automate Your Financial Categorization
                  </h2>
                  <p className="text-gray-400 text-lg leading-relaxed">
                    Upload bank statements, get AI-powered transaction categorization in seconds.
                    Save hours of manual work every month.
                  </p>
                </div>
              )}

              {/* Key Benefits */}
              {!planInfo && (
                <div className="w-full grid grid-cols-2 gap-4 mb-8">
                  {[
                    { icon: "⚡", label: "Instant Setup" },
                    { icon: "🎯", label: "99.9% Accuracy" },
                    { icon: "🔒", label: "Bank-level Security" },
                    { icon: "📊", label: "Smart Reports" },
                  ].map((benefit, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10"
                    >
                      <span className="text-xl">{benefit.icon}</span>
                      <span className="text-sm text-gray-300">{benefit.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Testimonial */}
              <div className="w-full p-5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-8 h-8 text-blue-400 flex-shrink-0 opacity-50"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>
                  <div>
                    <p className="text-gray-300 text-sm italic mb-2">
                      &ldquo;{currentTestimonial.quote}&rdquo;
                    </p>
                    <p className="text-gray-500 text-xs">
                      <span className="font-medium text-gray-400">{currentTestimonial.author}</span>
                      {" · "}
                      {currentTestimonial.role}
                    </p>
                  </div>
                </div>
                {/* Testimonial Dots */}
                <div className="flex justify-center gap-1.5 mt-4">
                  {testimonials.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setTestimonialIndex(idx)}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        idx === testimonialIndex ? "bg-blue-400 w-4" : "bg-gray-600"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Trust Indicators */}
              <div className="mt-8 flex items-center gap-6 text-gray-500 text-xs">
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>SOC 2</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                  </svg>
                  <span>256-bit SSL</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>GDPR</span>
                </div>
              </div>
            </div>
          </div>
          <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
            <ThemeTogglerTwo />
          </div>
        </div>
      </ThemeProvider>
    </div>
  );
}
