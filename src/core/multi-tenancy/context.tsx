"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { createClient as createBrowserClient } from "@/core/database/client";
import type { Database } from "@/core/database/types";

type Tenant = Database["public"]["Tables"]["tenants"]["Row"];

interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string | null;
  isLoading: boolean;
  error: string | null;
  setTenant: (tenant: Tenant | null) => void;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTenant = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const supabase = createBrowserClient();
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setTenant(null);
        setIsLoading(false);
        return;
      }

      // Get user's tenant_id from users table
      const userDataResult: { data: { tenant_id: string | null } | null; error: any } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const userData = userDataResult.data;
      if (userDataResult.error || !userData?.tenant_id) {
        setTenant(null);
        setIsLoading(false);
        return;
      }

      // Get tenant details
      const tenantResult: { data: Tenant | null; error: any } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", userData.tenant_id)
        .single();
      
      const tenantData = tenantResult.data;
      const tenantError = tenantResult.error;

      if (tenantError) {
        setError(tenantError.message);
        setTenant(null);
      } else {
        setTenant(tenantData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tenant");
      setTenant(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTenant();
    
    // Listen for auth changes
    const supabase = createBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadTenant();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshTenant = async () => {
    await loadTenant();
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        tenantId: tenant?.id || null,
        isLoading,
        error,
        setTenant,
        refreshTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

