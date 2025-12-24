/**
 * Update Transaction Tool
 * 
 * Allows the AI to modify transaction categories, notes, and confirmation status
 */

import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';

export const updateTransactionSchema = z.object({
  transactionId: z.string().describe('The ID of the transaction to update'),
  category: z.string().optional().describe('New category for the transaction'),
  subcategory: z.string().optional().describe('New subcategory for the transaction'),
  notes: z.string().optional().describe('Notes to add or update'),
  confirmed: z.boolean().optional().describe('Mark the categorization as confirmed'),
});

export type UpdateTransactionParams = z.infer<typeof updateTransactionSchema>;

export const updateTransactionDescription = `Update a transaction's category, subcategory, notes, or confirmation status.
Use this tool when the user wants to change how a transaction is categorized, 
add notes, or confirm a categorization. Always confirm with the user before making changes.`;

export async function executeUpdateTransaction(
  params: UpdateTransactionParams, 
  userId: string, 
  supabase: SupabaseClient
) {
  try {
    // First verify the transaction belongs to this user
    const { data: existing, error: fetchError } = await supabase
      .from('categorized_transactions')
      .select(`
        id,
        original_description,
        category,
        subcategory,
        user_notes,
        user_confirmed,
        job:categorization_jobs!inner(user_id)
      `)
      .eq('id', params.transactionId)
      .eq('job.user_id', userId)
      .single();

    if (fetchError || !existing) {
      return {
        success: false,
        error: 'Transaction not found or you do not have permission to update it.',
      };
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    const changes: string[] = [];

    if (params.category !== undefined && params.category !== existing.category) {
      updates.category = params.category;
      changes.push(`category: "${existing.category || 'none'}" → "${params.category}"`);
    }
    if (params.subcategory !== undefined && params.subcategory !== existing.subcategory) {
      updates.subcategory = params.subcategory;
      changes.push(`subcategory: "${existing.subcategory || 'none'}" → "${params.subcategory}"`);
    }
    if (params.notes !== undefined) {
      updates.user_notes = params.notes;
      changes.push(`notes updated`);
    }
    if (params.confirmed !== undefined && params.confirmed !== existing.user_confirmed) {
      updates.user_confirmed = params.confirmed;
      changes.push(`confirmed: ${existing.user_confirmed} → ${params.confirmed}`);
    }

    // If no changes, return early
    if (Object.keys(updates).length === 0) {
      return {
        success: true,
        message: 'No changes were made - the transaction already has these values.',
        transaction: {
          id: existing.id,
          description: existing.original_description,
          category: existing.category,
          subcategory: existing.subcategory,
          notes: existing.user_notes,
          confirmed: existing.user_confirmed,
        },
      };
    }

    // Perform the update
    const { data: updated, error: updateError } = await supabase
      .from('categorized_transactions')
      .update(updates)
      .eq('id', params.transactionId)
      .select('id, original_description, category, subcategory, user_notes, user_confirmed')
      .single();

    if (updateError) {
      return {
        success: false,
        error: `Failed to update transaction: ${updateError.message}`,
      };
    }

    // Also save this as a user category mapping for future AI suggestions
    if (params.category && existing.original_description) {
      // Extract a pattern from the description (first few words or merchant name)
      const pattern = existing.original_description.split(' ').slice(0, 3).join(' ');
      
      await supabase
        .from('user_category_mappings')
        .upsert({
          user_id: userId,
          pattern,
          category: params.category,
          subcategory: params.subcategory || null,
        }, {
          onConflict: 'user_id,pattern,category',
        });
    }

    return {
      success: true,
      message: `Transaction updated successfully. Changes: ${changes.join(', ')}`,
      transaction: {
        id: updated.id,
        description: updated.original_description,
        category: updated.category,
        subcategory: updated.subcategory,
        notes: updated.user_notes,
        confirmed: updated.user_confirmed,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
