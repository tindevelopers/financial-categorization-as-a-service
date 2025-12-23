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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.log('   Make sure you have a .env.local file with these variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check for VERCEL_OIDC_TOKEN (required for Vercel AI Gateway)
  if (!process.env.VERCEL_OIDC_TOKEN) {
    console.warn('⚠️  VERCEL_OIDC_TOKEN not found. You may need to run this with "vc dev" or manually set the token.');
    console.log('   Run: vc env pull .env.local && npx tsx scripts/seed-knowledge-embeddings.ts\n');
  }

  try {
    // 1. Fetch all active knowledge base entries
    console.log('📚 Fetching knowledge base entries...');
    const { data: knowledgeItems, error: fetchError } = await supabase
      .from('knowledge_base')
      .select('id, title, content, category, tags')
      .eq('is_active', true);

    if (fetchError) {
      throw new Error(`Failed to fetch knowledge base: ${fetchError.message}`);
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

