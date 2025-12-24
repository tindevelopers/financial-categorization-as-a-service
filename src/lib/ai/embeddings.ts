/**
 * Embedding Service for RAG
 * Adapted from vercel-labs/ai-gateway-embeddings-demo
 * 
 * Uses Vercel AI Gateway for embedding generation and Supabase pgvector for storage/search
 */

import { embed, embedMany } from 'ai';
import { createClient } from '@/core/database/server';

// Using text-embedding-ada-002 via Vercel AI Gateway
// This produces 1536-dimensional vectors
const EMBEDDING_MODEL = 'openai/text-embedding-ada-002';

// Type for embedding search results
interface EmbeddingSearchResult {
  id: string;
  content: string;
  source_type: string;
  source_id: string | null;
  metadata: Record<string, unknown>;
  similarity: number;
}

/**
 * Generate chunks from input text
 * Splits on sentences for better semantic coherence
 */
export function generateChunks(input: string): string[] {
  return input
    .trim()
    .split(/[.!?]+/)
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 10); // Filter out very short chunks
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(value: string): Promise<number[]> {
  const input = value.replace(/\n/g, ' ').trim();
  
  const { embedding } = await embed({
    model: EMBEDDING_MODEL,
    value: input,
  });
  
  return embedding;
}

/**
 * Generate embeddings for multiple texts
 */
export async function generateEmbeddings(
  values: string[]
): Promise<Array<{ content: string; embedding: number[] }>> {
  const { embeddings } = await embedMany({
    model: EMBEDDING_MODEL,
    values: values.map(v => v.replace(/\n/g, ' ').trim()),
  });
  
  return embeddings.map((embedding, i) => ({
    content: values[i],
    embedding,
  }));
}

/**
 * Find relevant content using cosine similarity search
 */
export async function findRelevantContent(
  query: string,
  options: {
    userId?: string;
    threshold?: number;
    limit?: number;
    sourceTypes?: string[];
  } = {}
): Promise<EmbeddingSearchResult[]> {
  const { userId, threshold = 0.5, limit = 5, sourceTypes } = options;
  
  const supabase = await createClient();
  const queryEmbedding = await generateEmbedding(query);
  
  // Use the match_embeddings RPC function
  // Cast to any to call custom RPC function not in generated types
  const { data, error } = await (supabase as unknown as {
    rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: EmbeddingSearchResult[] | null; error: Error | null }>;
  }).rpc('match_embeddings', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
    user_filter: userId || null,
  });
  
  if (error) {
    console.error('Error finding relevant content:', error);
    return [];
  }
  
  const results = data || [];
  
  // Filter by source types if specified
  if (sourceTypes && sourceTypes.length > 0) {
    return results.filter((item: EmbeddingSearchResult) => 
      sourceTypes.includes(item.source_type)
    );
  }
  
  return results;
}

/**
 * Add content to the knowledge base with embeddings
 */
export async function addToKnowledgeBase(
  content: string,
  options: {
    userId?: string;
    tenantId?: string;
    sourceType?: 'knowledge' | 'transaction' | 'document' | 'user_note';
    sourceId?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { 
    userId, 
    tenantId, 
    sourceType = 'knowledge', 
    sourceId, 
    metadata = {} 
  } = options;
  
  try {
    const supabase = await createClient();
    const embedding = await generateEmbedding(content);
    
    // Cast to any to insert into table not in generated types
    const { data, error } = await (supabase as unknown as {
      from: (table: string) => {
        insert: (data: Record<string, unknown>) => {
          select: (cols: string) => {
            single: () => Promise<{ data: { id: string } | null; error: Error | null }>;
          };
        };
      };
    }).from('embeddings')
      .insert({
        user_id: userId || null,
        tenant_id: tenantId || null,
        content,
        embedding,
        source_type: sourceType,
        source_id: sourceId || null,
        metadata,
      })
      .select('id')
      .single();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true, id: data?.id };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Add multiple content items to the knowledge base
 */
export async function addBulkToKnowledgeBase(
  items: Array<{
    content: string;
    sourceType?: 'knowledge' | 'transaction' | 'document' | 'user_note';
    sourceId?: string;
    metadata?: Record<string, unknown>;
  }>,
  options: {
    userId?: string;
    tenantId?: string;
  } = {}
): Promise<{ success: boolean; count: number; errors: string[] }> {
  const { userId, tenantId } = options;
  const errors: string[] = [];
  let count = 0;
  
  try {
    const supabase = await createClient();
    
    // Generate embeddings for all items
    const contents = items.map(item => item.content);
    const embeddingsResult = await generateEmbeddings(contents);
    
    // Prepare insert data
    const insertData = items.map((item, i) => ({
      user_id: userId || null,
      tenant_id: tenantId || null,
      content: item.content,
      embedding: embeddingsResult[i].embedding,
      source_type: item.sourceType || 'knowledge',
      source_id: item.sourceId || null,
      metadata: item.metadata || {},
    }));
    
    // Insert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < insertData.length; i += batchSize) {
      const batch = insertData.slice(i, i + batchSize);
      
      // Cast to any to insert into table not in generated types
      const { error } = await (supabase as unknown as {
        from: (table: string) => {
          insert: (data: Record<string, unknown>[]) => Promise<{ error: Error | null }>;
        };
      }).from('embeddings').insert(batch);
      
      if (error) {
        errors.push(`Batch ${i / batchSize}: ${error.message}`);
      } else {
        count += batch.length;
      }
    }
    
    return { success: errors.length === 0, count, errors };
  } catch (error) {
    return { 
      success: false, 
      count, 
      errors: [error instanceof Error ? error.message : 'Unknown error'] 
    };
  }
}

/**
 * Delete embeddings for a specific source
 */
export async function deleteEmbeddingsForSource(
  sourceId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    // Cast to any to delete from table not in generated types
    const { error } = await (supabase as unknown as {
      from: (table: string) => {
        delete: () => {
          eq: (col: string, val: string) => {
            eq: (col: string, val: string) => Promise<{ error: Error | null }>;
          };
        };
      };
    }).from('embeddings')
      .delete()
      .eq('source_id', sourceId)
      .eq('user_id', userId);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Embed and index the knowledge base content
 * This should be run once to populate embeddings from the knowledge_base table
 */
export async function embedKnowledgeBase(): Promise<{
  success: boolean;
  count: number;
  errors: string[];
}> {
  try {
    const supabase = await createClient();
    
    // Get all knowledge base items that don't have embeddings yet
    // Cast to any to query table not in generated types
    const { data: knowledgeItems, error: fetchError } = await (supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: boolean) => Promise<{ 
            data: Array<{ id: string; title: string; content: string; category: string; tags: string[] }> | null; 
            error: Error | null;
          }>;
        };
      };
    }).from('knowledge_base')
      .select('id, title, content, category, tags')
      .eq('is_active', true);
    
    if (fetchError) {
      return { success: false, count: 0, errors: [fetchError.message] };
    }
    
    if (!knowledgeItems || knowledgeItems.length === 0) {
      return { success: true, count: 0, errors: [] };
    }
    
    // Check which items already have embeddings
    const { data: existingEmbeddings } = await (supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            in: (col: string, vals: string[]) => Promise<{ 
              data: Array<{ source_id: string }> | null; 
              error: Error | null;
            }>;
          };
        };
      };
    }).from('embeddings')
      .select('source_id')
      .eq('source_type', 'knowledge')
      .in('source_id', knowledgeItems.map(k => k.id));
    
    const existingIds = new Set((existingEmbeddings || []).map(e => e.source_id));
    const newItems = knowledgeItems.filter(k => !existingIds.has(k.id));
    
    if (newItems.length === 0) {
      return { success: true, count: 0, errors: [] };
    }
    
    // Prepare content for embedding (combine title and content)
    const items = newItems.map(k => ({
      content: `${k.title}\n\n${k.content}`,
      sourceType: 'knowledge' as const,
      sourceId: k.id,
      metadata: { category: k.category, tags: k.tags },
    }));
    
    // Add to embeddings (global knowledge - no userId)
    return await addBulkToKnowledgeBase(items);
  } catch (error) {
    return { 
      success: false, 
      count: 0, 
      errors: [error instanceof Error ? error.message : 'Unknown error'] 
    };
  }
}
