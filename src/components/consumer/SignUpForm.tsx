"use client";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { signUp } from "@/app/actions/auth";

export default function ConsumerSignUpForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    tenantName: "",
    tenantDomain: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!isChecked) {
      setError("Please agree to the Terms and Conditions");
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
      });

      // Redirect to upload page after successful signup (consumer flow)
      router.push("/upload");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sign up";
      setError(errorMessage);
      console.error("Signup error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      {error && (
        <div className="mb-6 p-4 text-sm text-red-600 bg-red-50 rounded-lg dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <Label>
              First Name<span className="text-error-500">*</span>
            </Label>
            <Input
              type="text"
              placeholder="Enter your first name"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>
              Last Name<span className="text-error-500">*</span>
            </Label>
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
          <Label>
            Email<span className="text-error-500">*</span>
          </Label>
          <Input
            type="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>
            Organization Name<span className="text-error-500">*</span>
          </Label>
          <Input
            type="text"
            placeholder="Enter your organization name"
            value={formData.tenantName}
            onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>Password<span className="text-error-500">*</span></Label>
          <div className="relative">
            <Input
              placeholder="Enter your password (min 8 characters)"
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={8}
            />
            <span
              onClick={() => setShowPassword(!showPassword)}
              className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
            >
              {showPassword ? (
                <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
              ) : (
                <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
              )}
            </span>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            className="w-5 h-5 mt-0.5"
            checked={isChecked}
            onChange={setIsChecked}
          />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            By creating an account, you agree to the{" "}
            <Link href="/terms" className="text-blue-600 hover:text-blue-700 dark:text-blue-400">
              Terms and Conditions
            </Link>{" "}
            and our{" "}
            <Link href="/privacy" className="text-blue-600 hover:text-blue-700 dark:text-blue-400">
              Privacy Policy
            </Link>
          </p>
        </div>
        <Button 
          type="submit" 
          className="w-full" 
          size="sm"
          disabled={isLoading}
        >
          {isLoading ? "Creating Account..." : "Create Account"}
        </Button>
      </form>
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{" "}
          <Link
            href="/signin"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

