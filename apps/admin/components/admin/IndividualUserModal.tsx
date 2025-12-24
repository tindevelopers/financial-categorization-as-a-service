"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { createIndividualUser, type CreateIndividualUserData } from "@/app/actions/users";

interface IndividualUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function IndividualUserModal({ isOpen, onClose, onSuccess }: IndividualUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ tenantId?: string; tenantDomain?: string; userId?: string } | null>(null);
  
  const [formData, setFormData] = useState<CreateIndividualUserData>({
    email: "",
    full_name: "",
    password: "",
    plan: "starter",
    status: "active",
  });

  // Generate preview domain (will be generated server-side)
  const [previewDomain, setPreviewDomain] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      // Reset form
      setFormData({
        email: "",
        full_name: "",
        password: "",
        plan: "starter",
        status: "active",
      });
      setError(null);
      setSuccess(null);
      setPreviewDomain("individual-{uuid}");
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (!formData.password || formData.password.length < 8) {
        setError("Password must be at least 8 characters");
        setLoading(false);
        return;
      }

      const result = await createIndividualUser(formData);

      if (result.success && result.user && result.tenant) {
        setSuccess({
          tenantId: result.tenant.id,
          tenantDomain: result.tenant.domain,
          userId: result.user.id,
        });
        // Wait a moment for database consistency, then refresh
        await new Promise(resolve => setTimeout(resolve, 500));
        await onSuccess();
        // Close modal after showing success
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError(result.error || "Failed to create individual user");
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
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Create Individual User
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
              <p className="font-semibold mb-2">Individual user created successfully!</p>
              <div className="space-y-1 text-xs">
                <p>Tenant ID: {success.tenantId}</p>
                <p>Tenant Domain: {success.tenantDomain}</p>
                <p>User ID: {success.userId}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
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
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
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
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="At least 8 characters"
              minLength={8}
            />
          </div>

          <div>
            <Label>Tenant Domain</Label>
            <Input
              type="text"
              value={previewDomain}
              disabled
              className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
              placeholder="Auto-generated"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Domain will be auto-generated in the format: individual-{`{uuid}`}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <Label>Status</Label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !!success}>
              {loading ? "Creating..." : "Create Individual User"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

