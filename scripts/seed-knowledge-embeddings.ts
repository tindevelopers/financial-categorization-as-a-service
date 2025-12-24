/**
 * Seed Knowledge Base Embeddings Script
 * 
 * This script generates embeddings for all knowledge base entries
 * and stores them in the embeddings table for RAG search.
 * 
 * Run with: npx tsx scripts/seed-knowledge-embeddings.ts
 */

import { createClient } from '@supabase/supabase-js';
import { embed } from 'ai';
import 'dotenv/config';

const EMBEDDING_MODEL = 'openai/text-embedding-ada-002';

async function main() {
  console.log('🚀 Starting knowledge base embedding generation...\n');

  // Create Supabase client
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Remove quotes if present
  if (supabaseUrl) {
    supabaseUrl = supabaseUrl.replace(/^["']|["']$/g, '');
  }
  if (supabaseServiceKey) {
    supabaseServiceKey = supabaseServiceKey.replace(/^["']|["']$/g, '');
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.log('   Make sure you have a .env.local file with these variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  console.log('🔗 Connecting to database...\n');

  // Check for VERCEL_OIDC_TOKEN (required for Vercel AI Gateway)
  if (!process.env.VERCEL_OIDC_TOKEN) {
    console.warn('⚠️  VERCEL_OIDC_TOKEN not found. You may need to run this with "vc dev" or manually set the token.');
    console.log('   Run: vc env pull .env.local && npx tsx scripts/seed-knowledge-embeddings.ts\n');
  }

  try {
    // 1. Fetch all active knowledge base entries
    console.log('📚 Fetching knowledge base entries...');
    let knowledgeItems;
    
    // Try REST API directly first to bypass schema cache
    try {
      const restUrl = `${supabaseUrl}/rest/v1/knowledge_base?is_active=eq.true&select=id,title,content,category,tags`;
      const response = await fetch(restUrl, {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`   REST API returned ${response.status}: ${errorText.substring(0, 200)}`);
        throw new Error(`REST API error: ${response.status}`);
      }
      
      knowledgeItems = await response.json();
      console.log(`   ✅ Fetched ${knowledgeItems.length} entries via REST API\n`);
    } catch (restError) {
      // Fallback to Supabase client
      console.log(`   REST API failed (${restError instanceof Error ? restError.message : 'unknown'}), trying Supabase client...`);
      const { data, error: fetchError } = await supabase
        .from('knowledge_base')
        .select('id, title, content, category, tags')
        .eq('is_active', true);

      if (fetchError) {
        if (fetchError.message.includes('schema cache') || fetchError.message.includes('not found')) {
          console.error('❌ Schema cache issue detected.');
          console.log('   The table exists but Supabase client cache needs refresh.');
          console.log('   Solution: Wait 2-5 minutes after migration, then retry.');
          console.log('   Or the migration may not have been applied. Check with:');
          console.log('   supabase migration list --linked');
          throw new Error(`Schema cache error: ${fetchError.message}`);
        }
        throw new Error(`Failed to fetch knowledge base: ${fetchError.message}`);
      }
      knowledgeItems = data;
    }

    if (!knowledgeItems || knowledgeItems.length === 0) {
      console.log('ℹ️  No knowledge base entries found. Run the SQL migration first.');
      return;
    }

    console.log(`   Found ${knowledgeItems.length} entries\n`);

    // 2. Check which entries already have embeddings
    console.log('🔍 Checking existing embeddings...');
    const { data: existingEmbeddings } = await supabase
      .from('embeddings')
      .select('source_id')
      .eq('source_type', 'knowledge');

    const existingIds = new Set((existingEmbeddings || []).map(e => e.source_id));
    const newItems = knowledgeItems.filter(k => !existingIds.has(k.id));

    if (newItems.length === 0) {
      console.log('✅ All knowledge base entries already have embeddings!');
      return;
    }

    console.log(`   ${existingIds.size} entries already embedded`);
    console.log(`   ${newItems.length} entries need embeddings\n`);

    // 3. Generate embeddings for each entry
    console.log('🧠 Generating embeddings...');
    let successCount = 0;
    let errorCount = 0;

    for (const item of newItems) {
      try {
        // Combine title and content for embedding
        const textToEmbed = `${item.title}\n\n${item.content}`;
        
        // Generate embedding
        const { embedding } = await embed({
          model: EMBEDDING_MODEL,
          value: textToEmbed.replace(/\n/g, ' '),
        });

        // Store in embeddings table
        const { error: insertError } = await supabase
          .from('embeddings')
          .insert({
            content: textToEmbed,
            embedding,
            source_type: 'knowledge',
            source_id: item.id,
            metadata: {
              category: item.category,
              tags: item.tags,
              title: item.title,
            },
          });

        if (insertError) {
          throw insertError;
        }

        successCount++;
        console.log(`   ✓ ${item.category}/${item.title}`);
      } catch (error) {
        errorCount++;
        console.error(`   ✗ ${item.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // 4. Summary
    console.log('\n📊 Summary:');
    console.log(`   ✅ Successfully embedded: ${successCount}`);
    if (errorCount > 0) {
      console.log(`   ❌ Failed: ${errorCount}`);
    }
    console.log('\n🎉 Knowledge base embedding complete!');

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

