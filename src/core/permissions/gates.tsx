/**
 * Permission Gates - UI Components
 * 
 * React components for conditionally rendering UI based on permissions
 */

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createClient as createBrowserClient } from "@/core/database/client";
import { hasPermissionClient, hasAnyPermissionClient, hasAllPermissionsClient } from "./permissions-client";
import type { Permission } from "./permissions";

interface PermissionGateProps {
  permission: Permission | Permission[];
  requireAll?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * PermissionGate - Conditionally render children based on permissions
 */
export function PermissionGate({
  permission,
  requireAll = false,
  fallback = null,
  children,
}: PermissionGateProps) {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkPermission() {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      try {
        if (Array.isArray(permission)) {
          if (requireAll) {
            const access = await hasAllPermissionsClient(user.id, permission);
            setHasAccess(access);
          } else {
            const access = await hasAnyPermissionClient(user.id, permission);
            setHasAccess(access);
          }
        } else {
          const access = await hasPermissionClient(user.id, permission);
          setHasAccess(access);
        }
      } catch (error) {
        console.error("Permission check error:", error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    }

    checkPermission();
  }, [permission, requireAll]);

  if (loading) {
    return null; // Or a loading spinner
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

/**
 * RequirePermission - Higher-order component for protecting routes/components
 */
export function RequirePermission({
  permission,
  requireAll = false,
  children,
}: Omit<PermissionGateProps, "fallback">) {
  return (
    <PermissionGate permission={permission} requireAll={requireAll}>
      {children}
    </PermissionGate>
  );
}

/**
 * RequireAnyPermission - Render if user has any of the specified permissions
 */
export function RequireAnyPermission({
  permissions,
  fallback = null,
  children,
}: {
  permissions: Permission[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PermissionGate permission={permissions} requireAll={false} fallback={fallback}>
      {children}
    </PermissionGate>
  );
}

/**
 * RequireAllPermissions - Render if user has all specified permissions
 */
export function RequireAllPermissions({
  permissions,
  fallback = null,
  children,
}: {
  permissions: Permission[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PermissionGate permission={permissions} requireAll={true} fallback={fallback}>
      {children}
    </PermissionGate>
  );
}

