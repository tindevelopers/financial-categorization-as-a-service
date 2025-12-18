"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { createClient as createBrowserClient } from "@/core/database/client";
import type { Database } from "@/core/database/types";
import type { SystemMode } from "./types";

type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
type Tenant = Database["public"]["Tables"]["tenants"]["Row"];

interface OrganizationContextType {
  organization: Workspace | null;
  organizationId: string | null;
  tenant: Tenant | null;
  tenantId: string | null;
  mode: SystemMode;
  isLoading: boolean;
  error: string | null;
  setOrganization: (organization: Workspace | null) => void;
  refreshOrganization: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganization] = useState<Workspace | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [mode, setMode] = useState<SystemMode>('multi-tenant');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContext = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const supabase = createBrowserClient();
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setOrganization(null);
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
        setOrganization(null);
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

      if (tenantError || !tenantData) {
        setError(tenantError?.message || "Failed to load tenant");
        setOrganization(null);
        setTenant(null);
        setIsLoading(false);
        return;
      }

      setTenant(tenantData);
      
      // Determine mode from tenant settings
      const tenantMode = (tenantData as any).mode || 'multi-tenant';
      setMode(tenantMode as SystemMode);

      // In organization-only mode, load user's organizations
      if (tenantMode === 'organization-only') {
        // Get user's workspaces (organizations)
        const workspaceResult: { data: Workspace[] | null; error: any } = await supabase
          .from("workspaces")
          .select("*")
          .eq("tenant_id", tenantData.id)
          .limit(1);

        if (workspaceResult.data && workspaceResult.data.length > 0) {
          setOrganization(workspaceResult.data[0]);
        }
      } else {
        // In multi-tenant mode, try to get organization from session/localStorage
        const savedOrgId = localStorage.getItem('current_organization_id');
        if (savedOrgId) {
          const orgResult: { data: Workspace | null; error: any } = await supabase
            .from("workspaces")
            .select("*")
            .eq("id", savedOrgId)
            .eq("tenant_id", tenantData.id)
            .single();
          
          if (orgResult.data) {
            setOrganization(orgResult.data);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load organization context");
      setOrganization(null);
      setTenant(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadContext();
    
    // Listen for auth changes
    const supabase = createBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadContext();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshOrganization = async () => {
    await loadContext();
  };

  const switchOrganization = async (organizationId: string) => {
    try {
      const supabase = createBrowserClient();
      const orgResult: { data: Workspace | null; error: any } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", organizationId)
        .single();
      
      if (orgResult.data) {
        setOrganization(orgResult.data);
        localStorage.setItem('current_organization_id', organizationId);
      } else {
        throw new Error("Organization not found");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch organization");
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        organizationId: organization?.id || null,
        tenant,
        tenantId: tenant?.id || null,
        mode,
        isLoading,
        error,
        setOrganization,
        refreshOrganization,
        switchOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
}

