/**
 * Tenant Switcher Component
 * 
 * Allows users to switch between tenants they have access to
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserClient } from "@/core/database/client";
import { useTenant } from "@/core/multi-tenancy";
import { getAllTenants } from "@/app/actions/tenants";
import { isPlatformAdmin } from "@/app/actions/organization-admins";
import {
  BuildingOffice2Icon,
  ChevronDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import type { Database } from "@/core/database/types";

type Tenant = Database["public"]["Tables"]["tenants"]["Row"];

interface TenantSwitcherProps {
  className?: string;
}

export default function TenantSwitcher({ className = "" }: TenantSwitcherProps) {
  const router = useRouter();
  const { tenant, tenantId, isLoading: tenantLoading } = useTenant();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPlatformAdminUser, setIsPlatformAdminUser] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadTenants() {
      try {
        setIsLoading(true);
        const [tenantsData, adminStatus] = await Promise.all([
          getAllTenants(),
          isPlatformAdmin(),
        ]);
        setTenants(tenantsData as Tenant[]);
        setIsPlatformAdminUser(adminStatus);
      } catch (error) {
        console.error("Error loading tenants:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (isOpen) {
      loadTenants();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleTenantSwitch = async (newTenantId: string) => {
    if (newTenantId === tenantId) {
      setIsOpen(false);
      return;
    }

    try {
      const supabase = createBrowserClient();
      
      // Set tenant context in session/localStorage
      localStorage.setItem("current_tenant_id", newTenantId);
      
      // Update tenant context
      // The TenantProvider will pick this up on next render
      
      // Reload the page to refresh tenant context
      router.refresh();
      setIsOpen(false);
    } catch (error) {
      console.error("Error switching tenant:", error);
    }
  };

  const filteredTenants = tenants.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // For Platform Admins, show all tenants
  // For regular users, show only their tenant (should be 1)
  const displayTenants = isPlatformAdminUser ? filteredTenants : tenants;

  if (tenantLoading || !tenant) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 ${className}`}>
        <div className="h-8 w-8 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-w-[200px]"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {tenant.avatar_url ? (
            <Image
              src={tenant.avatar_url}
              alt={tenant.name}
              width={24}
              height={24}
              className="rounded-lg flex-shrink-0"
            />
          ) : (
            <div className="h-6 w-6 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0">
              <BuildingOffice2Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
            </div>
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {tenant.name}
          </span>
        </div>
        <ChevronDownIcon
          className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          {/* Search */}
          {isPlatformAdminUser && displayTenants.length > 3 && (
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tenants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Tenant List */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                Loading tenants...
              </div>
            ) : displayTenants.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                {searchQuery ? "No tenants found" : "No tenants available"}
              </div>
            ) : (
              displayTenants.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleTenantSwitch(t.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    t.id === tenantId ? "bg-indigo-50 dark:bg-indigo-900/20" : ""
                  }`}
                >
                  {t.avatar_url ? (
                    <Image
                      src={t.avatar_url}
                      alt={t.name}
                      width={32}
                      height={32}
                      className="rounded-lg flex-shrink-0"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0">
                      <BuildingOffice2Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {t.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {t.domain}
                    </div>
                  </div>
                  {t.id === tenantId && (
                    <CheckIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-300 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {isPlatformAdminUser && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  router.push("/saas/admin/entity/tenant-management");
                  setIsOpen(false);
                }}
                className="w-full text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
              >
                Manage Tenants
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


