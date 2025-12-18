/**
 * Shared CRUD Helpers
 * 
 * Generic CRUD operations for tenant-scoped entities
 * Reduces code duplication across different modules
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database";

type TableName = keyof Database["public"]["Tables"];

export interface CrudOptions<T extends TableName> {
  tenantId?: string | null;
  organizationId?: string | null;
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
}

export interface CreateOptions {
  createdBy?: string | null;
  logActivity?: boolean;
  activityEntityType?: string;
  /** Optional callback for logging entity creation */
  onEntityCreated?: (entityType: string, entityId: string, entityName: string) => Promise<void>;
}

export interface UpdateOptions {
  logActivity?: boolean;
  activityEntityType?: string;
  activityEntityName?: string;
  /** Optional callback for logging entity updates */
  onEntityUpdated?: (entityType: string, entityId: string, entityName: string, updates: Record<string, any>) => Promise<void>;
}

export interface DeleteOptions {
  logActivity?: boolean;
  activityEntityType?: string;
  activityEntityName?: string;
  /** Optional callback for logging entity deletion */
  onEntityDeleted?: (entityType: string, entityId: string, entityName: string) => Promise<void>;
}

/**
 * Generic function to get all records for a tenant
 */
export async function crudGetAll<T extends TableName>(
  supabase: SupabaseClient<Database>,
  table: T,
  options: CrudOptions<T> = {}
): Promise<any[]> {
  let query: any = supabase.from(table);

  // Apply tenant filter
  if (options.tenantId) {
    query = query.eq("tenant_id", options.tenantId);
  }

  // Apply organization filter if provided
  if (options.organizationId) {
    query = query.eq("organization_id", options.organizationId);
  }

  // Apply select
  if (options.select) {
    query = query.select(options.select);
  } else {
    query = query.select("*");
  }

  // Apply ordering
  if (options.orderBy) {
    query = query.order(options.orderBy.column, {
      ascending: options.orderBy.ascending ?? true,
    });
  } else {
    // Default ordering by created_at
    query = query.order("created_at", { ascending: false });
  }

  // Apply limit
  if (options.limit) {
    query = query.limit(options.limit);
  }

  // Apply offset
  if (options.offset !== undefined && options.limit) {
    query = query.range(options.offset, options.offset + options.limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`Error fetching ${table}:`, error);
    throw error;
  }

  return (data as any[]) || [];
}

/**
 * Generic function to get a single record by ID
 */
export async function crudGetById<T extends TableName>(
  supabase: SupabaseClient<Database>,
  table: T,
  id: string,
  options: CrudOptions<T> = {}
): Promise<any | null> {
  let query: any = supabase.from(table);

  // Apply select
  if (options.select) {
    query = query.select(options.select);
  } else {
    query = query.select("*");
  }

  query = query.eq("id", id);

  // Apply tenant filter
  if (options.tenantId) {
    query = query.eq("tenant_id", options.tenantId);
  }

  // Apply organization filter if provided
  if (options.organizationId) {
    query = query.eq("organization_id", options.organizationId);
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    console.error(`Error fetching ${table}:`, error);
    throw error;
  }

  return data as any;
}

/**
 * Generic function to create a record
 */
export async function crudCreate<T extends TableName>(
  supabase: SupabaseClient<Database>,
  table: T,
  data: Record<string, any>,
  options: CrudOptions<T> & CreateOptions = {}
): Promise<any> {
  // Get current user for created_by
  let createdBy = options.createdBy;
  if (!createdBy) {
    const { data: { user } } = await supabase.auth.getUser();
    createdBy = user?.id || null;
  }

  const insertData = {
    ...data,
    tenant_id: options.tenantId || data.tenant_id,
    organization_id: options.organizationId || data.organization_id,
    created_by: createdBy,
  };

  const { data: result, error } = await (supabase.from(table) as any)
    .insert(insertData)
    .select("*")
    .single();

  if (error) {
    console.error(`Error creating ${table}:`, error);
    throw error;
  }

  // Log activity if requested
  if (options.logActivity && options.activityEntityType && options.onEntityCreated) {
    try {
      await options.onEntityCreated(
        options.activityEntityType,
        result.id,
        result.name || result.title || `${options.activityEntityType} ${result.id}`
      );
    } catch (err) {
      // Activity logging is optional, don't fail if it errors
      console.warn("Failed to log activity:", err);
    }
  }

  return result as any;
}

/**
 * Generic function to update a record
 */
export async function crudUpdate<T extends TableName>(
  supabase: SupabaseClient<Database>,
  table: T,
  id: string,
  updates: Record<string, any>,
  options: CrudOptions<T> & UpdateOptions = {}
): Promise<any> {
  let query: any = supabase.from(table);

  query = query.update(updates).eq("id", id);

  // Apply tenant filter
  if (options.tenantId) {
    query = query.eq("tenant_id", options.tenantId);
  }

  // Apply organization filter if provided
  if (options.organizationId) {
    query = query.eq("organization_id", options.organizationId);
  }

  const { data, error } = await query.select("*").single();

  if (error) {
    console.error(`Error updating ${table}:`, error);
    throw error;
  }

  // Log activity if requested
  if (options.logActivity && options.activityEntityType && options.onEntityUpdated) {
    try {
      await options.onEntityUpdated(
        options.activityEntityType,
        id,
        options.activityEntityName || data.name || data.title || `${options.activityEntityType} ${id}`,
        updates
      );
    } catch (err) {
      console.warn("Failed to log activity:", err);
    }
  }

  return data as any;
}

/**
 * Generic function to delete a record
 */
export async function crudDelete<T extends TableName>(
  supabase: SupabaseClient<Database>,
  table: T,
  id: string,
  options: CrudOptions<T> & DeleteOptions = {}
): Promise<void> {
  // Get record name before deletion for activity log
  let entityName: string | null = null;
  if (options.logActivity && options.activityEntityType) {
    const record = await crudGetById(supabase, table, id, {
      tenantId: options.tenantId,
      organizationId: options.organizationId,
      select: "name, title",
    });
    entityName = record?.name || record?.title || null;
  }

  let query: any = supabase.from(table);

  query = query.delete().eq("id", id);

  // Apply tenant filter
  if (options.tenantId) {
    query = query.eq("tenant_id", options.tenantId);
  }

  // Apply organization filter if provided
  if (options.organizationId) {
    query = query.eq("organization_id", options.organizationId);
  }

  const { error } = await query;

  if (error) {
    console.error(`Error deleting ${table}:`, error);
    throw error;
  }

  // Log activity if requested
  if (options.logActivity && options.activityEntityType && entityName && options.onEntityDeleted) {
    try {
      await options.onEntityDeleted(
        options.activityEntityType,
        id,
        entityName
      );
    } catch (err) {
      console.warn("Failed to log activity:", err);
    }
  }
}

