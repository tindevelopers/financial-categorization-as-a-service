/**
 * Shared Query Helpers
 * 
 * Reusable query patterns for database operations
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database";

type TableName = keyof Database["public"]["Tables"];

export interface QueryFilters {
  tenantId?: string | null;
  organizationId?: string | null;
  [key: string]: any;
}

export interface QueryOptions {
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
  filters?: QueryFilters;
}

/**
 * Apply common filters to a query
 */
export function applyFilters(
  query: any,
  filters: QueryFilters = {}
): any {
  let filteredQuery = query;

  // Apply tenant filter
  if (filters.tenantId) {
    filteredQuery = filteredQuery.eq("tenant_id", filters.tenantId);
  }

  // Apply organization filter
  if (filters.organizationId) {
    filteredQuery = filteredQuery.eq("organization_id", filters.organizationId);
  }

  // Apply other filters
  for (const [key, value] of Object.entries(filters)) {
    if (key !== 'tenantId' && key !== 'organizationId' && value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        filteredQuery = filteredQuery.in(key, value);
      } else if (typeof value === 'string' && value.includes('%')) {
        // LIKE query for partial matches
        filteredQuery = filteredQuery.like(key, value);
      } else {
        filteredQuery = filteredQuery.eq(key, value);
      }
    }
  }

  return filteredQuery;
}

/**
 * Build a query with common options
 */
export function buildQuery<T extends TableName>(
  supabase: SupabaseClient<Database>,
  table: T,
  options: QueryOptions = {}
): any {
  let query: any = supabase.from(table);

  // Apply select
  if (options.select) {
    query = query.select(options.select);
  } else {
    query = query.select("*");
  }

  // Apply filters
  if (options.filters) {
    query = applyFilters(query, options.filters);
  }

  // Apply ordering
  if (options.orderBy) {
    query = query.order(options.orderBy.column, {
      ascending: options.orderBy.ascending ?? true,
    });
  }

  // Apply limit
  if (options.limit) {
    query = query.limit(options.limit);
  }

  // Apply offset
  if (options.offset !== undefined && options.limit) {
    query = query.range(options.offset, options.offset + options.limit - 1);
  }

  return query;
}

/**
 * Execute query and handle errors
 */
export async function executeQuery<T>(
  query: Promise<{ data: T | null; error: any }>,
  errorMessage: string = "Query failed"
): Promise<T> {
  const { data, error } = await query;

  if (error) {
    console.error(`${errorMessage}:`, error);
    throw new Error(`${errorMessage}: ${error.message}`);
  }

  if (!data) {
    throw new Error(`${errorMessage}: No data returned`);
  }

  return data;
}

/**
 * Execute query that may return null
 */
export async function executeQueryNullable<T>(
  query: Promise<{ data: T | null; error: any }>,
  errorMessage: string = "Query failed"
): Promise<T | null> {
  const { data, error } = await query;

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found - return null
      return null;
    }
    console.error(`${errorMessage}:`, error);
    throw new Error(`${errorMessage}: ${error.message}`);
  }

  return data;
}

