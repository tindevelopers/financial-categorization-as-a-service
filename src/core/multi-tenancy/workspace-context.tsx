"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { createClient as createBrowserClient } from "@/core/database/client";
import type { Database } from "@/core/database/types";
import { useTenant } from "@/core/multi-tenancy";

type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];

interface WorkspaceContextType {
  workspace: Workspace | null;
  workspaceId: string | null;
  isLoading: boolean;
  error: string | null;
  setWorkspace: (workspace: Workspace | null) => void;
  refreshWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { tenantId } = useTenant();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspace = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!tenantId) {
        setWorkspace(null);
        setIsLoading(false);
        return;
      }

      const supabase = createBrowserClient();

      // Check localStorage for workspace override
      const storedWorkspaceId =
        typeof window !== "undefined" ? localStorage.getItem("current_workspace_id") : null;

      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setWorkspace(null);
        setIsLoading(false);
        return;
      }

      // If workspace ID is stored, use it
      if (storedWorkspaceId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: workspaceData, error: workspaceError } = await (supabase as any)
          .from("workspaces")
          .select("*")
          .eq("id", storedWorkspaceId)
          .eq("tenant_id", tenantId)
          .single();

        if (!workspaceError && workspaceData) {
          setWorkspace(workspaceData as Workspace);
          setIsLoading(false);
          return;
        }
      }

      // Try to get default workspace for tenant directly (simpler approach)
      // This avoids the complex join that may fail if tables don't exist
      try {
        // First try to get workspace from workspace_users
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const workspaceUsersResult = await (supabase as any)
          .from("workspace_users")
          .select("workspace_id")
          .eq("user_id", user.id)
          .limit(1);

        if (!workspaceUsersResult.error && workspaceUsersResult.data?.length > 0) {
          const workspaceId = workspaceUsersResult.data[0].workspace_id;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: workspaceData, error: workspaceError } = await (supabase as any)
            .from("workspaces")
            .select("*")
            .eq("id", workspaceId)
            .single();

          if (!workspaceError && workspaceData) {
            setWorkspace(workspaceData as Workspace);
            setIsLoading(false);
            return;
          }
        }
      } catch (workspaceUsersError) {
        // workspace_users table might not exist, continue to fallback
        console.warn("Could not query workspace_users:", workspaceUsersError);
      }

      // Fallback: get default workspace for tenant
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: defaultWorkspace, error: defaultError } = await (supabase as any)
        .from("workspaces")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("slug", "default")
        .single();

      if (!defaultError && defaultWorkspace) {
        setWorkspace(defaultWorkspace as Workspace);
      } else {
        // No workspace found, that's okay
        setWorkspace(null);
      }
    } catch (err) {
      console.error("Error loading workspace:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
      setWorkspace(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      loadWorkspace();
    } else {
      setWorkspace(null);
      setIsLoading(false);
    }
  }, [tenantId]);

  const refreshWorkspace = async () => {
    await loadWorkspace();
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        workspaceId: workspace?.id || null,
        isLoading,
        error,
        setWorkspace,
        refreshWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
