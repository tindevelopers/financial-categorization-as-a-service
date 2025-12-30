"use client";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { signIn } from "@/app/actions/auth";
import { isGlobalAdminRole } from "@tinadmin/core/shared";

export default function SignInForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn({
        email: formData.email,
        password: formData.password,
      });

      const roleName = (result.user as any)?.roles?.name;
      const tenantId = result.user?.tenant_id;
      const isGlobalAdmin = isGlobalAdminRole(roleName) && !tenantId;

      console.log("[SignInForm] Sign in successful:", {
        userId: result.user?.id,
        email: result.user?.email,
        roleName,
        tenantId,
        isGlobalAdmin,
      });

      // Force a page refresh to ensure session is properly set
      // Redirect based on user role
      if (isGlobalAdmin) {
        // Global admins go to the full admin dashboard
        window.location.href = "/saas/dashboard";
      } else {
        // Non-global users should not be logging in here; send them back to portal.
        const portalDomain =
          process.env.NEXT_PUBLIC_PORTAL_DOMAIN ||
          process.env.NEXT_PUBLIC_APP_URL ||
          null;
        if (portalDomain) {
          window.location.href = portalDomain.startsWith("http")
            ? `${portalDomain}/signin`
            : `https://${portalDomain}/signin`;
        }
        setError("Access denied. This portal is for system administrators only.");
        return;
      }
    } catch (err) {
      console.error("[SignInForm] Sign in error:", err);
      setError(err instanceof Error ? err.message : "Failed to sign in. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          {/* Restricted Access Banner */}
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Restricted Access
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  System Administrators Only
                </p>
              </div>
            </div>
          </div>

          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Admin Sign In
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your administrator credentials to access the platform.
            </p>
          </div>
          <div>
            {error && (
              <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-lg dark:bg-red-900/20 dark:text-red-400 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div>
                  <Label>
                    Admin Email <span className="text-error-500">*</span>{" "}
                  </Label>
                  <Input 
                    type="email"
                    placeholder="admin@company.com" 
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>
                    Password <span className="text-error-500">*</span>{" "}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={isChecked} onChange={setIsChecked} />
                    <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                      Keep me logged in
                    </span>
                  </div>
                </div>
                <div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    size="sm"
                    disabled={isLoading}
                  >
                    {isLoading ? "Authenticating..." : "Sign In"}
                  </Button>
                </div>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-center text-gray-500 dark:text-gray-500">
                Looking for customer access?{" "}
                <a
                  href="http://localhost:3002/signin"
                  className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  Go to Customer Portal
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
