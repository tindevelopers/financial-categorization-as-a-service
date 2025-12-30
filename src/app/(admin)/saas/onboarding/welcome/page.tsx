"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSubscriptionType, type SubscriptionType } from "@/app/actions/subscription";
import Button from "@/components/ui/button/Button";
import Link from "next/link";
import { CheckCircleIcon } from "@/icons";

interface PlanDetails {
  title: string;
  description: string;
  icon: string;
  color: string;
  nextSteps: { title: string; description: string; link?: string; linkText?: string }[];
  authMethods: string[];
  showUpgrade: boolean;
  upgradeText?: string;
}

const planDetails: Record<SubscriptionType, PlanDetails> = {
  individual: {
    title: "Individual",
    description: "OAuth authentication ready. Connect your Google account to get started with transaction categorization.",
    icon: "👤",
    color: "blue",
    nextSteps: [
      {
        title: "Connect Google Account",
        description: "Link your Google account to access Sheets and Drive integration.",
        link: "/saas/integrations/google",
        linkText: "Connect Now",
      },
      {
        title: "Upload Transactions",
        description: "Import your bank statements in CSV or Excel format.",
        link: "/saas/upload",
        linkText: "Upload Files",
      },
      {
        title: "Review Categories",
        description: "Customize and fine-tune your transaction categories.",
        link: "/saas/categories",
        linkText: "View Categories",
      },
    ],
    authMethods: ["Google OAuth (Platform Credentials)"],
    showUpgrade: true,
    upgradeText: "Need more control? Upgrade to Company for custom credentials.",
  },
  company: {
    title: "Company",
    description: "You have flexible authentication options. Choose between OAuth or bring your own Google credentials.",
    icon: "🏢",
    color: "emerald",
    nextSteps: [
      {
        title: "Choose Authentication Method",
        description: "Use OAuth for quick setup, or configure your own Google Cloud credentials for more control.",
        link: "/saas/settings/subscription",
        linkText: "Configure Auth",
      },
      {
        title: "Invite Team Members",
        description: "Add colleagues to collaborate on transaction categorization.",
        link: "/saas/team",
        linkText: "Invite Team",
      },
      {
        title: "Upload Transactions",
        description: "Import your company's bank statements for categorization.",
        link: "/saas/upload",
        linkText: "Upload Files",
      },
    ],
    authMethods: ["Google OAuth", "Custom OAuth Credentials", "Company Credentials"],
    showUpgrade: true,
    upgradeText: "Need enterprise features? Contact us to upgrade.",
  },
  enterprise: {
    title: "Enterprise",
    description: "Enterprise-grade security with full control. You must configure your own Google credentials.",
    icon: "🏛️",
    color: "purple",
    nextSteps: [
      {
        title: "Configure Google Credentials",
        description: "Set up your Google Cloud project and service account for secure API access.",
        link: "/saas/settings/subscription",
        linkText: "Configure Credentials",
      },
      {
        title: "Set Up SSO",
        description: "Configure Single Sign-On for your organization.",
        link: "/saas/settings/sso",
        linkText: "Configure SSO",
      },
      {
        title: "Review Security Settings",
        description: "Configure audit logs, access controls, and compliance settings.",
        link: "/saas/settings/security",
        linkText: "Security Settings",
      },
    ],
    authMethods: ["Custom OAuth Credentials (Required)", "Service Account"],
    showUpgrade: false,
  },
};

export default function WelcomePage() {
  const router = useRouter();
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscriptionType();
  }, []);

  const loadSubscriptionType = async () => {
    try {
      const result = await getSubscriptionType();
      if (result.success && result.subscriptionType) {
        setSubscriptionType(result.subscriptionType);
      } else {
        // Default to individual if not set
        setSubscriptionType("individual");
      }
    } catch (error) {
      console.error("Failed to load subscription type:", error);
      setSubscriptionType("individual");
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    localStorage.setItem("welcome_seen", "true");
    router.push("/saas/dashboard");
  };

  const handleSkip = () => {
    localStorage.setItem("welcome_seen", "true");
    router.push("/saas/dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Setting up your account...</p>
        </div>
      </div>
    );
  }

  const plan = subscriptionType ? planDetails[subscriptionType] : planDetails.individual;
  
  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; border: string; text: string; lightBg: string }> = {
      blue: {
        bg: "bg-blue-600",
        border: "border-blue-500",
        text: "text-blue-600 dark:text-blue-400",
        lightBg: "bg-blue-50 dark:bg-blue-900/20",
      },
      emerald: {
        bg: "bg-emerald-600",
        border: "border-emerald-500",
        text: "text-emerald-600 dark:text-emerald-400",
        lightBg: "bg-emerald-50 dark:bg-emerald-900/20",
      },
      purple: {
        bg: "bg-purple-600",
        border: "border-purple-500",
        text: "text-purple-600 dark:text-purple-400",
        lightBg: "bg-purple-50 dark:bg-purple-900/20",
      },
    };
    return colors[color] || colors.blue;
  };

  const colorClasses = getColorClasses(plan.color);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Success Header */}
          <div className="text-center mb-10">
            <div className={`inline-flex items-center justify-center w-20 h-20 ${colorClasses.lightBg} rounded-full mb-6`}>
              <span className="text-5xl">{plan.icon}</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
              Welcome to Your Account!
            </h1>
            <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircleIcon className="w-5 h-5" />
              <span className="font-medium">Account created successfully</span>
            </div>
          </div>

          {/* Plan Card */}
          <div className={`p-6 rounded-2xl border-2 ${colorClasses.border} ${colorClasses.lightBg} mb-8`}>
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 ${colorClasses.bg} rounded-xl flex items-center justify-center text-white text-2xl`}>
                {plan.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {plan.title} Plan
                  </h2>
                  <Link
                    href="/saas/settings/subscription"
                    className={`text-sm ${colorClasses.text} hover:underline`}
                  >
                    Manage Plan →
                  </Link>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mt-1 mb-4">
                  {plan.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {plan.authMethods.map((method, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded"
                    >
                      {method}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Enterprise Warning */}
          {subscriptionType === "enterprise" && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 mb-8">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-300">
                    Action Required: Configure Credentials
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                    Enterprise accounts require custom Google Cloud credentials. Please configure your credentials before using integrations.
                  </p>
                  <Link
                    href="/saas/settings/subscription"
                    className="inline-block mt-2 text-sm font-medium text-amber-800 dark:text-amber-300 hover:underline"
                  >
                    Configure Now →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Next Steps */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recommended Next Steps
            </h3>
            <div className="space-y-3">
              {plan.nextSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                >
                  <div className={`w-8 h-8 ${colorClasses.bg} rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {step.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                      {step.description}
                    </p>
                  </div>
                  {step.link && (
                    <Link
                      href={step.link}
                      className={`text-sm ${colorClasses.text} hover:underline flex-shrink-0`}
                    >
                      {step.linkText || "Go"} →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Upgrade Banner */}
          {plan.showUpgrade && (
            <div className="p-5 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {plan.upgradeText}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    You can upgrade anytime from Settings.
                  </p>
                </div>
                <Link href="/saas/settings/subscription">
                  <Button variant="outline" size="sm">
                    View Options
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" onClick={handleSkip} className="order-2 sm:order-1">
              Skip for Now
            </Button>
            <Button onClick={handleContinue} className="order-1 sm:order-2">
              Go to Dashboard
            </Button>
          </div>

          {/* Help Link */}
          <div className="text-center mt-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Need help getting started?{" "}
              <Link href="/saas/help/subscription-types" className="text-blue-600 dark:text-blue-400 hover:underline">
                Read our guide
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
