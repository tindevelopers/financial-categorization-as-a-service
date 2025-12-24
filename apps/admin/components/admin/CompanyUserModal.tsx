"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { createCompanyUser, type CreateCompanyUserData } from "@/app/actions/users";

interface CompanyUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CompanyUserModal({ isOpen, onClose, onSuccess }: CompanyUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ tenantId?: string; tenantDomain?: string; userId?: string; companyProfileId?: string } | null>(null);
  
  const [formData, setFormData] = useState<CreateCompanyUserData>({
    companyName: "",
    companyType: "sole_trader",
    companyNumber: "",
    domain: "",
    adminEmail: "",
    adminFullName: "",
    adminPassword: "",
    plan: "starter",
    region: "us-east-1",
    status: "active",
  });

  useEffect(() => {
    if (isOpen) {
      // Reset form
      setFormData({
        companyName: "",
        companyType: "sole_trader",
        companyNumber: "",
        domain: "",
        adminEmail: "",
        adminFullName: "",
        adminPassword: "",
        plan: "starter",
        region: "us-east-1",
        status: "active",
      });
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.domain) {
        setError("Domain is required");
        setLoading(false);
        return;
      }

      if (!formData.adminPassword || formData.adminPassword.length < 8) {
        setError("Password must be at least 8 characters");
        setLoading(false);
        return;
      }

      if (formData.companyType === "limited_company" && !formData.companyNumber) {
        setError("Company number is required for limited companies");
        setLoading(false);
        return;
      }

      const result = await createCompanyUser(formData);

      if (result.success && result.user && result.tenant && result.companyProfile) {
        setSuccess({
          tenantId: result.tenant.id,
          tenantDomain: result.tenant.domain,
          userId: result.user.id,
          companyProfileId: result.companyProfile.id,
        });
        // Wait a moment for database consistency, then refresh
        await new Promise(resolve => setTimeout(resolve, 500));
        await onSuccess();
        // Close modal after showing success
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError(result.error || "Failed to create company user");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Create Company User
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
              <p className="font-semibold mb-2">Company user created successfully!</p>
              <div className="space-y-1 text-xs">
                <p>Tenant ID: {success.tenantId}</p>
                <p>Tenant Domain: {success.tenantDomain}</p>
                <p>User ID: {success.userId}</p>
                <p>Company Profile ID: {success.companyProfileId}</p>
              </div>
            </div>
          )}

          {/* Company Details Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Company Details
            </h3>
            
            <div>
              <Label>
                Company Name <span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                required
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="Acme Corporation"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>
                  Company Type <span className="text-red-500">*</span>
                </Label>
                <select
                  value={formData.companyType}
                  onChange={(e) => setFormData({ ...formData, companyType: e.target.value as any, companyNumber: e.target.value !== "limited_company" ? "" : formData.companyNumber })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="sole_trader">Sole Trader</option>
                  <option value="partnership">Partnership</option>
                  <option value="limited_company">Limited Company</option>
                </select>
              </div>

              {formData.companyType === "limited_company" && (
                <div>
                  <Label>
                    Company Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    required={formData.companyType === "limited_company"}
                    value={formData.companyNumber}
                    onChange={(e) => setFormData({ ...formData, companyNumber: e.target.value })}
                    placeholder="12345678"
                  />
                </div>
              )}
            </div>

            <div>
              <Label>
                Domain <span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                required
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                placeholder="acme-corp"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Unique domain identifier for the tenant (e.g., acme-corp)
              </p>
            </div>
          </div>

          {/* Admin User Details Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Admin User Details
            </h3>
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="text"
                  required
                  value={formData.adminFullName}
                  onChange={(e) => setFormData({ ...formData, adminFullName: e.target.value })}
                  placeholder="John Doe"
                />
              </div>

              <div>
                <Label>
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="email"
                  required
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            <div>
              <Label>
                Password <span className="text-red-500">*</span>
              </Label>
              <Input
                type="password"
                required
                value={formData.adminPassword}
                onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                placeholder="At least 8 characters"
                minLength={8}
              />
            </div>
          </div>

          {/* Tenant Settings Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Tenant Settings
            </h3>
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>Plan</Label>
                <select
                  value={formData.plan}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value as any })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <Label>Region</Label>
                <select
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="us-east-1">US East</option>
                  <option value="us-west-1">US West</option>
                  <option value="eu-west-1">EU West</option>
                  <option value="ap-southeast-1">AP Southeast</option>
                </select>
              </div>

              <div>
                <Label>Status</Label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !!success}>
              {loading ? "Creating..." : "Create Company User"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

