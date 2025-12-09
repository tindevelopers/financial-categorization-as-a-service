/**
 * Permission Audit Logging
 * 
 * Logs all permission checks and access attempts for compliance and security
 */

import { createAdminClient } from "@/core/database/admin-client";

type AuditLogInsert = {
  user_id: string;
  tenant_id?: string | null;
  workspace_id?: string | null;
  action: string;
  resource: string;
  permission: string;
  allowed: boolean;
  reason?: string | null;
  metadata?: Record<string, any>;
  ip_address?: string | null;
  user_agent?: string | null;
};

export interface PermissionAuditLog {
  userId: string;
  tenantId?: string | null;
  workspaceId?: string | null;
  action: string;
  resource: string;
  permission: string;
  allowed: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Create audit log entry for permission check
 */
export async function logPermissionCheck(
  log: PermissionAuditLog
): Promise<void> {
  try {
    const adminClient = createAdminClient();
    
    // Check if audit_logs table exists, if not, skip logging
    // In production, this table should exist
    const auditLog: AuditLogInsert = {
      user_id: log.userId,
      tenant_id: log.tenantId || null,
      workspace_id: log.workspaceId || null,
      action: log.action,
      resource: log.resource,
      permission: log.permission,
      allowed: log.allowed,
      reason: log.reason || null,
      metadata: log.metadata || {},
      ip_address: null, // Can be added from request context
      user_agent: null, // Can be added from request context
    };

    // Try to insert, but don't fail if table doesn't exist yet
    try {
      await ((adminClient.from("audit_logs") as any).insert(auditLog as any));
    } catch (error: any) {
      // If table doesn't exist, log to console for now
      if (error.code === "42P01") {
        console.log("[Audit Log] Table not found, logging to console:", auditLog);
      } else {
        console.error("[Audit Log] Error logging permission check:", error);
      }
    }
  } catch (error) {
    // Don't throw - audit logging should not break the application
    console.error("[Audit Log] Failed to log permission check:", error);
  }
}

/**
 * Log permission check with automatic context
 */
export async function logPermissionCheckWithContext(
  userId: string,
  permission: string,
  allowed: boolean,
  options?: {
    tenantId?: string | null;
    workspaceId?: string | null;
    action?: string;
    resource?: string;
    reason?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  await logPermissionCheck({
    userId,
    tenantId: options?.tenantId,
    workspaceId: options?.workspaceId,
    action: options?.action || "permission_check",
    resource: options?.resource || "unknown",
    permission,
    allowed,
    reason: options?.reason,
    metadata: options?.metadata,
  });
}

/**
 * Query audit logs (for admin users)
 */
export async function getAuditLogs(options?: {
  userId?: string;
  tenantId?: string;
  workspaceId?: string | null;
  action?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const adminClient = createAdminClient();
    
    let query = adminClient
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (options?.userId) {
      query = query.eq("user_id", options.userId);
    }

    if (options?.tenantId) {
      query = query.eq("tenant_id", options.tenantId);
    }

    if (options?.workspaceId !== undefined) {
      if (options.workspaceId === null) {
        // Filter for tenant-level logs (workspace_id IS NULL)
        query = query.is("workspace_id", null);
      } else {
        query = query.eq("workspace_id", options.workspaceId);
      }
    }

    if (options?.action) {
      query = query.eq("action", options.action);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 10)) - 1);
    }

    const { data, error } = await query;

    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === "42P01") {
        return [];
      }
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("[Audit Log] Error querying audit logs:", error);
    return [];
  }
}

