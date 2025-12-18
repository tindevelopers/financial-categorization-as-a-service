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
        const { data: workspaceData, error: workspaceError } = await supabase
          .from("workspaces")
          .select("*")
          .eq("id", storedWorkspaceId)
          .eq("tenant_id", tenantId)
          .single();

        if (!workspaceError && workspaceData) {
          setWorkspace(workspaceData);
          setIsLoading(false);
          return;
        }
      }

      // Otherwise, get user's workspaces and use the first one
      const workspaceUsersResult: { data: Array<{ workspace_id: string; workspaces: Workspace }> | null; error: any } = await supabase
        .from("workspace_users")
        .select(`
          workspace_id,
          workspaces!workspace_users_workspace_id_fkey (*)
        `)
        .eq("user_id", user.id)
        .limit(1);

      const workspaceUsers = workspaceUsersResult.data;
      if (workspaceUsersResult.error) {
        // Try to get default workspace for tenant
        const defaultResult: { data: Workspace | null; error: any } = await supabase
          .from("workspaces")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("slug", "default")
          .single();

        const defaultWorkspace = defaultResult.data;
        if (!defaultResult.error && defaultWorkspace) {
          setWorkspace(defaultWorkspace);
        } else {
          setWorkspace(null);
        }
      } else if (workspaceUsers && workspaceUsers.length > 0) {
        const workspaceData = workspaceUsers[0].workspaces as Workspace;
        setWorkspace(workspaceData);
      } else {
        // No workspace found, try default
        const { data: defaultWorkspace, error: defaultError } = await supabase
          .from("workspaces")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("slug", "default")
          .single();

        if (!defaultError && defaultWorkspace) {
          setWorkspace(defaultWorkspace);
        } else {
          setWorkspace(null);
        }
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
