"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { signUp } from "@/app/actions/auth";

type SubscriptionType = "individual" | "company" | "enterprise";

interface SubscriptionOption {
  type: SubscriptionType;
  title: string;
  description: string;
  features: string[];
  authMethods: string[];
  icon: string;
  color: string;
}

const subscriptionOptions: SubscriptionOption[] = [
  {
    type: "individual",
    title: "Individual",
    description: "Perfect for personal use and small projects",
    features: [
      "Simple OAuth authentication",
      "Platform-managed credentials",
      "Quick setup - no configuration needed",
      "Up to 1,000 transactions/month",
    ],
    authMethods: ["OAuth (Platform credentials)"],
    icon: "👤",
    color: "blue",
  },
  {
    type: "company",
    title: "Company",
    description: "Flexible authentication options for businesses",
    features: [
      "OAuth or Bring Your Own credentials",
      "Company-provided credentials option",
      "Team collaboration",
      "Up to 10,000 transactions/month",
    ],
    authMethods: ["OAuth", "Bring Your Own Credentials", "Company Credentials"],
    icon: "🏢",
    color: "emerald",
  },
  {
    type: "enterprise",
    title: "Enterprise",
    description: "Full control with enterprise-grade security",
    features: [
      "Bring Your Own Google credentials required",
      "Full control over authentication",
      "Enterprise-grade security",
      "Unlimited transactions",
    ],
    authMethods: ["Bring Your Own Credentials (Required)"],
    icon: "🏛️",
    color: "purple",
  },
];

type StepId = "plan" | "account" | "review";

interface Step {
  id: StepId;
  number: number;
  title: string;
  description: string;
}

export default function SignupWizard() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<ReturnType<
    typeof createBrowserClient
  > | null>(null);

  const [preSelectedPlan, setPreSelectedPlan] =
    useState<SubscriptionType | null>(null);
  const [selectedSubscriptionType, setSelectedSubscriptionType] =
    useState<SubscriptionType | null>(null);
  const [currentStepId, setCurrentStepId] = useState<StepId>("plan");

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    organizationName: "",
  });

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      setSupabase(createBrowserClient(supabaseUrl, supabaseAnonKey));
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("selectedSubscriptionType");
      if (stored && ["individual", "company", "enterprise"].includes(stored)) {
        setPreSelectedPlan(stored as SubscriptionType);
        setSelectedSubscriptionType(stored as SubscriptionType);
        setCurrentStepId("account");
      }
    }
  }, []);

  useEffect(() => {
    const password = formData.password;
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    setPasswordStrength(strength);
  }, [formData.password]);

  const steps: Step[] = preSelectedPlan
    ? [
        {
          id: "account",
          number: 1,
          title: "Account Details",
          description: "Enter your information",
        },
        {
          id: "review",
          number: 2,
          title: "Review & Confirm",
          description: "Verify your details",
        },
      ]
    : [
        {
          id: "plan",
          number: 1,
          title: "Choose Plan",
          description: "Select your subscription",
        },
        {
          id: "account",
          number: 2,
          title: "Account Details",
          description: "Enter your information",
        },
        {
          id: "review",
          number: 3,
          title: "Review & Confirm",
          description: "Verify your details",
        },
      ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStepId);
  const currentStep = steps[currentStepIndex];

  const handleSubscriptionSelect = (type: SubscriptionType) => {
    setSelectedSubscriptionType(type);
    setError(null);
  };

  const handleNext = () => {
    if (currentStepId === "plan") {
      if (!selectedSubscriptionType) {
        setError("Please select a subscription type");
        return;
      }
      setError(null);
      setCurrentStepId("account");
    } else if (currentStepId === "account") {
      if (
        !formData.fullName ||
        !formData.email ||
        !formData.password ||
        !formData.confirmPassword
      ) {
        setError("Please fill in all required fields");
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (formData.password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }
      setError(null);
      setCurrentStepId("review");
    }
  };

  const handleBack = () => {
    if (currentStepId === "account") {
      if (preSelectedPlan) {
        router.push("/pricing");
      } else {
        setCurrentStepId("plan");
      }
    } else if (currentStepId === "review") {
      setCurrentStepId("account");
    }
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!agreedToTerms) {
      setError("Please agree to the Terms and Conditions");
      setIsLoading(false);
      return;
    }

    if (!selectedSubscriptionType) {
      setError("Please select a subscription type");
      setIsLoading(false);
      return;
    }

    try {
      // Map subscriptionType to plan
      const planMap: Record<SubscriptionType, string> = {
        individual: "starter",
        company: "business_standard",
        enterprise: "enterprise",
      };

      const plan = planMap[selectedSubscriptionType];
      
      // Generate tenant domain from email or organization name
      const tenantDomain = formData.organizationName
        ? formData.organizationName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
        : formData.email.split("@")[1] || "example.com";
      
      const tenantName = formData.organizationName || `${formData.fullName}'s Organization`;

      // Call server action that properly creates tenant and user
      const result = await signUp({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        tenantName: tenantName,
        tenantDomain: tenantDomain,
        plan: plan,
        subscriptionType: selectedSubscriptionType,
        region: "us-east-1",
      });

      if (typeof window !== "undefined") {
        sessionStorage.removeItem("selectedSubscriptionType");
      }

      router.push("/dashboard");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to sign up";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedOption = subscriptionOptions.find(
    (opt) => opt.type === selectedSubscriptionType
  );

  const getColorClasses = (color: string, isSelected: boolean) => {
    const colors: Record<string, { border: string; bg: string }> = {
      blue: {
        border: isSelected
          ? "border-blue-500 ring-2 ring-blue-500/20"
          : "border-gray-200 dark:border-gray-700",
        bg: isSelected ? "bg-blue-50 dark:bg-blue-900/20" : "",
      },
      emerald: {
        border: isSelected
          ? "border-emerald-500 ring-2 ring-emerald-500/20"
          : "border-gray-200 dark:border-gray-700",
        bg: isSelected ? "bg-emerald-50 dark:bg-emerald-900/20" : "",
      },
      purple: {
        border: isSelected
          ? "border-purple-500 ring-2 ring-purple-500/20"
          : "border-gray-200 dark:border-gray-700",
        bg: isSelected ? "bg-purple-50 dark:bg-purple-900/20" : "",
      },
    };
    return colors[color] || colors.blue;
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 1) return "bg-red-500";
    if (passwordStrength <= 2) return "bg-orange-500";
    if (passwordStrength <= 3) return "bg-yellow-500";
    if (passwordStrength <= 4) return "bg-lime-500";
    return "bg-green-500";
  };

  const getPasswordStrengthLabel = () => {
    if (passwordStrength <= 1) return "Weak";
    if (passwordStrength <= 2) return "Fair";
    if (passwordStrength <= 3) return "Good";
    if (passwordStrength <= 4) return "Strong";
    return "Very Strong";
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">FC</span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              FinCat
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 py-8 px-4">
        <div className="max-w-xl mx-auto">
          {/* Step Indicators */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((step, idx) => {
                const isActive = step.id === currentStepId;
                const isCompleted = currentStepIndex > idx;

                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                          isCompleted
                            ? "bg-green-500 text-white"
                            : isActive
                            ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {isCompleted ? (
                          <svg
                            className="w-5 h-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          step.number
                        )}
                      </div>
                      <div className="mt-2 text-center">
                        <p
                          className={`text-xs font-medium ${
                            isActive
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          {step.title}
                        </p>
                      </div>
                    </div>
                    {idx < steps.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 ${
                          isCompleted
                            ? "bg-green-500"
                            : "bg-gray-200 dark:bg-gray-700"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Page Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {currentStep?.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {currentStep?.description}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-lg dark:bg-red-900/20 dark:text-red-400 flex items-center gap-2">
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </div>
          )}

          {/* Step 1: Plan Selection */}
          {currentStepId === "plan" && (
            <div className="space-y-4">
              <div className="grid gap-4">
                {subscriptionOptions.map((option) => {
                  const isSelected = selectedSubscriptionType === option.type;
                  const colors = getColorClasses(option.color, isSelected);

                  return (
                    <div
                      key={option.type}
                      onClick={() => handleSubscriptionSelect(option.type)}
                      className={`relative cursor-pointer rounded-xl border-2 p-5 transition-all ${colors.border} ${colors.bg} hover:shadow-md bg-white dark:bg-gray-800`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="text-3xl">{option.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              {option.title}
                            </h3>
                            {isSelected && (
                              <svg
                                className="w-6 h-6 text-green-500"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {option.description}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-3">
                            {option.authMethods.map((method, idx) => (
                              <span
                                key={idx}
                                className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                              >
                                {method}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {option.type === "enterprise" && (
                        <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <svg
                            className="w-3 h-3"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Requires Google credentials setup
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleNext}
                  disabled={!selectedSubscriptionType}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Account Details */}
          {currentStepId === "account" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleNext();
              }}
              className="space-y-5"
            >
              {selectedOption && (
                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{selectedOption.icon}</span>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedOption.title} Plan
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {selectedOption.description}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (preSelectedPlan) {
                          router.push("/pricing");
                        } else {
                          setCurrentStepId("plan");
                        }
                      }}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email<span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  placeholder="Your company or project name (optional)"
                  value={formData.organizationName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      organizationName: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password<span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 characters"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                    minLength={8}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showPassword ? (
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
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    ) : (
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
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                {formData.password && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${getPasswordStrengthColor()}`}
                          style={{ width: `${(passwordStrength / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-20">
                        {getPasswordStrengthLabel()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirm Password<span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      confirmPassword: e.target.value,
                    })
                  }
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 justify-between pt-4">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Continue
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Review & Confirm */}
          {currentStepId === "review" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                  Review Your Information
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{selectedOption?.icon}</span>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Plan
                        </p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedOption?.title}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (preSelectedPlan) {
                          router.push("/pricing");
                        } else {
                          setCurrentStepId("plan");
                        }
                      }}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Name
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formData.fullName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Email
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formData.email}
                      </span>
                    </div>
                    {formData.organizationName && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Organization
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formData.organizationName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedSubscriptionType === "enterprise" && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-300">
                        Enterprise Setup Required
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                        After signup, you&apos;ll need to configure your Google
                        credentials in Settings.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label
                  htmlFor="terms"
                  className="text-sm text-gray-600 dark:text-gray-400"
                >
                  I agree to the{" "}
                  <Link
                    href="/terms"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Privacy Policy
                  </Link>
                </label>
              </div>

              <div className="flex gap-3 justify-between pt-4">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isLoading}
                  className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !agreedToTerms}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Creating Account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{" "}
              <Link
                href="/signin"
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

