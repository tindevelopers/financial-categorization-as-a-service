/**
 * Supabase Storage Utilities for Financial Documents
 * Simplified version for portal app
 */

import { SupabaseClient } from "@supabase/supabase-js";

const BUCKET_NAME = "categorization-uploads";

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFromSupabase(
  supabase: SupabaseClient,
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (error) {
      console.error("Failed to delete from Supabase Storage:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Delete from Supabase Storage error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}

