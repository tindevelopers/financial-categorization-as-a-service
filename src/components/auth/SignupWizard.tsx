"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon, CheckCircleIcon } from "@/icons";
import { signUp } from "@/app/actions/auth";
import type { SubscriptionType } from "@/app/actions/subscription";

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

// Step definitions for clarity
type StepId = "plan" | "account" | "review";

interface Step {
  id: StepId;
  number: number;
  title: string;
  description: string;
}

export default function SignupWizard() {
  const router = useRouter();
  
  // Check for pre-selected plan from choose-plan page
  const [preSelectedPlan, setPreSelectedPlan] = useState<SubscriptionType | null>(null);
  const [selectedSubscriptionType, setSelectedSubscriptionType] = useState<SubscriptionType | null>(null);
  const [currentStepId, setCurrentStepId] = useState<StepId>("plan");
  
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    tenantName: "",
    tenantDomain: "",
  });

  // Initialize from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("selectedSubscriptionType");
      if (stored && ["individual", "company", "enterprise"].includes(stored)) {
        setPreSelectedPlan(stored as SubscriptionType);
        setSelectedSubscriptionType(stored as SubscriptionType);
        setCurrentStepId("account"); // Skip to account step
      }
    }
  }, []);

  // Calculate password strength
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

  // Define steps based on whether plan is pre-selected
  const steps: Step[] = preSelectedPlan
    ? [
        { id: "account", number: 1, title: "Account Details", description: "Enter your information" },
        { id: "review", number: 2, title: "Review & Confirm", description: "Verify your details" },
      ]
    : [
        { id: "plan", number: 1, title: "Choose Plan", description: "Select your subscription" },
        { id: "account", number: 2, title: "Account Details", description: "Enter your information" },
        { id: "review", number: 3, title: "Review & Confirm", description: "Verify your details" },
      ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStepId);
  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;

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
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.tenantName) {
        setError("Please fill in all required fields");
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
        // Go back to pricing page
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
    setErrorCode(null);
    setIsLoading(true);

    if (!isChecked) {
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
      const result = await signUp({
        email: formData.email,
        password: formData.password,
        fullName: `${formData.firstName} ${formData.lastName}`,
        tenantName: formData.tenantName || `${formData.firstName}'s Organization`,
        tenantDomain: formData.tenantDomain || formData.email.split("@")[1] || "example.com",
        plan: "starter",
        region: "us-east-1",
        subscriptionType: selectedSubscriptionType,
      });

      if (!result.ok) {
        setErrorCode(result.error.code);
        setError(result.error.message);
        return;
      }

      // Clear the stored plan
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("selectedSubscriptionType");
      }

      // Redirect to welcome screen
      const welcomeSeen = typeof window !== "undefined" && localStorage.getItem("welcome_seen");
      if (!welcomeSeen) {
        router.push("/saas/onboarding/welcome");
      } else {
        router.push("/saas/dashboard");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sign up";
      setError(errorMessage);
      console.error("Signup error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedOption = subscriptionOptions.find((opt) => opt.type === selectedSubscriptionType);

  const getColorClasses = (color: string, isSelected: boolean) => {
    const colors: Record<string, { border: string; bg: string; text: string; ring: string }> = {
      blue: {
        border: isSelected ? "border-blue-500" : "border-gray-200 dark:border-gray-700",
        bg: isSelected ? "bg-blue-50 dark:bg-blue-900/20" : "",
        text: "text-blue-600 dark:text-blue-400",
        ring: "ring-blue-500",
      },
      emerald: {
        border: isSelected ? "border-emerald-500" : "border-gray-200 dark:border-gray-700",
        bg: isSelected ? "bg-emerald-50 dark:bg-emerald-900/20" : "",
        text: "text-emerald-600 dark:text-emerald-400",
        ring: "ring-emerald-500",
      },
      purple: {
        border: isSelected ? "border-purple-500" : "border-gray-200 dark:border-gray-700",
        bg: isSelected ? "bg-purple-50 dark:bg-purple-900/20" : "",
        text: "text-purple-600 dark:text-purple-400",
        ring: "ring-purple-500",
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
    <div className="flex flex-col flex-1 lg:w-1/2 w-full overflow-y-auto no-scrollbar">
      <div className="w-full max-w-xl sm:pt-10 mx-auto mb-5 px-4">
        <Link
          href="/pricing"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon />
          Back to plans
        </Link>
      </div>

      <div className="flex flex-col justify-center flex-1 w-full max-w-xl mx-auto px-4 pb-8">
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
                        <CheckCircleIcon className="w-5 h-5" />
                      ) : (
                        step.number
                      )}
                    </div>
                    <div className="mt-2 text-center">
                      <p className={`text-xs font-medium ${isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`}>
                        {step.title}
                      </p>
                    </div>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 ${isCompleted ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"}`} />
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
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="flex-1">{error}</span>
            {errorCode === "ACCOUNT_EXISTS" && (
              <Link
                href="/signin"
                className="text-red-700 dark:text-red-300 underline underline-offset-2"
              >
                Sign in
              </Link>
            )}
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
                    className={`relative cursor-pointer rounded-xl border-2 p-5 transition-all ${colors.border} ${colors.bg} hover:shadow-md`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-3xl">{option.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {option.title}
                          </h3>
                          {isSelected && (
                            <div className={`w-6 h-6 rounded-full bg-${option.color}-500 flex items-center justify-center`}>
                              <CheckCircleIcon className="w-4 h-4 text-white" />
                            </div>
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
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Requires Google credentials setup
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleNext} disabled={!selectedSubscriptionType}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Account Details */}
        {currentStepId === "account" && (
          <form onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
            <div className="space-y-5">
              {/* Selected Plan Banner */}
              {selectedOption && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
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
                    <Link
                      href="/pricing"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Change
                    </Link>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>First Name<span className="text-red-500">*</span></Label>
                  <Input
                    type="text"
                    placeholder="Enter your first name"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Last Name<span className="text-red-500">*</span></Label>
                  <Input
                    type="text"
                    placeholder="Enter your last name"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Email<span className="text-red-500">*</span></Label>
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Organization Name<span className="text-red-500">*</span></Label>
                <Input
                  type="text"
                  placeholder="Your company or project name"
                  value={formData.tenantName}
                  onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Organization Domain</Label>
                <Input
                  type="text"
                  placeholder="company.com (optional)"
                  value={formData.tenantDomain}
                  onChange={(e) => setFormData({ ...formData, tenantDomain: e.target.value })}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Optional: Used for team member invitations
                </p>
              </div>

              <div>
                <Label>Password<span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    placeholder="Min 8 characters"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                  >
                    {showPassword ? (
                      <EyeIcon className="fill-gray-500 dark:fill-gray-400 w-5 h-5" />
                    ) : (
                      <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 w-5 h-5" />
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

              <div className="flex gap-3 justify-between pt-4">
                <Button type="button" variant="outline" onClick={handleBack}>
                  Back
                </Button>
                <Button type="submit">Continue</Button>
              </div>
            </div>
          </form>
        )}

        {/* Step 3: Review & Confirm */}
        {currentStepId === "review" && (
          <form onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                  Review Your Information
                </h3>

                <div className="space-y-4">
                  {/* Plan */}
                  <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{selectedOption?.icon}</span>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Plan</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedOption?.title}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStepId("plan")}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Edit
                    </button>
                  </div>

                  {/* Account Info */}
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Name</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formData.firstName} {formData.lastName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Email</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formData.email}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Organization</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formData.tenantName}
                      </span>
                    </div>
                    {formData.tenantDomain && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Domain</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formData.tenantDomain}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedSubscriptionType === "enterprise" && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-300">
                        Enterprise Setup Required
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                        After signup, you&apos;ll need to configure your Google credentials in Settings → Integrations.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Checkbox
                  className="w-5 h-5 mt-0.5"
                  checked={isChecked}
                  onChange={setIsChecked}
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  I agree to the{" "}
                  <Link href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline">
                    Terms of Service
                  </Link>
                  {" "}and{" "}
                  <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
                    Privacy Policy
                  </Link>
                </p>
              </div>

              <div className="flex gap-3 justify-between pt-4">
                <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading}>
                  Back
                </Button>
                <Button type="submit" disabled={isLoading || !isChecked}>
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating Account...
                    </span>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{" "}
            <Link href="/signin" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
