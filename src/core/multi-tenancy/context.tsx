"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { createBrowserClient, type Database } from "@/core/database";

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
      
      // Check localStorage for tenant override (from tenant switcher)
      const storedTenantId = typeof window !== "undefined" 
        ? localStorage.getItem("current_tenant_id")
        : null;
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setTenant(null);
        setIsLoading(false);
        return;
      }

      // Get user's tenant_id from users table
      const { data: userData, error: userDataError } = await supabase
        .from("users")
        .select("tenant_id, roles:role_id(name)")
        .eq("id", user.id)
        .single();

      if (userDataError || !userData) {
        setTenant(null);
        setIsLoading(false);
        return;
      }

      // Determine which tenant_id to use
      // Priority: storedTenantId (from switcher) > userData.tenant_id
      // Platform Admins can have tenant_id = null
      const roleName = (userData.roles as any)?.name;
      const isPlatformAdmin = roleName === "Platform Admin" && userData.tenant_id === null;
      
      let targetTenantId: string | null = null;
      
      if (storedTenantId) {
        // Use tenant from switcher if available
        targetTenantId = storedTenantId;
      } else if (!isPlatformAdmin && userData.tenant_id) {
        // Use user's tenant_id (unless Platform Admin)
        targetTenantId = userData.tenant_id;
      }

      // Get tenant details
      if (targetTenantId) {
        const { data: tenantData, error: tenantError } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", targetTenantId)
          .single();

        if (tenantError) {
          // Don't set error for RLS policy failures when user isn't authenticated
          if (tenantError.code !== 'PGRST301' && tenantError.code !== '42501') {
            setError(tenantError.message);
          }
          setTenant(null);
        } else {
          setTenant(tenantData);
        }
      } else {
        // Platform Admin or no tenant
        setTenant(null);
      }
    } catch (err) {
      // Don't show error for unauthenticated access
      if (err instanceof Error && !err.message.includes('JWT')) {
        setError(err.message);
      }
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

