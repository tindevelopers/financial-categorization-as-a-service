/**
 * Search Knowledge Tool
 * 
 * Allows the AI to search the RAG knowledge base for UK tax/accounting information
 */

import { z } from 'zod';
import { findRelevantContent } from '../embeddings';

export const searchKnowledgeSchema = z.object({
  query: z.string().describe('The question or topic to search for'),
  category: z.enum(['all', 'hmrc', 'vat', 'accounting', 'app_help']).default('all').describe(
    'Filter by knowledge category: hmrc (tax rules), vat (VAT guidance), accounting (general), app_help (how to use FinCat)'
  ),
  includeUserContext: z.boolean().default(false).describe(
    'Whether to include user-specific transaction patterns in the search'
  ),
});

export type SearchKnowledgeParams = z.infer<typeof searchKnowledgeSchema>;

export const searchKnowledgeDescription = `Search the knowledge base for UK tax, accounting, HMRC guidance, and app help information.
Use this tool FIRST when the user asks questions about:
- Tax rules and regulations
- Allowable/disallowable expenses
- VAT registration and rates
- HMRC categories and requirements
- How to use FinCat features
- Accounting best practices

Always search the knowledge base before giving tax or accounting advice.`;

export async function executeSearchKnowledge(
  params: SearchKnowledgeParams, 
  userId?: string
) {
  try {
    // Determine source types based on category
    let sourceTypes: string[] | undefined;
    if (params.category !== 'all') {
      sourceTypes = ['knowledge'];
    }
    if (params.includeUserContext && userId) {
      sourceTypes = sourceTypes 
        ? [...sourceTypes, 'transaction', 'user_note']
        : ['knowledge', 'transaction', 'user_note'];
    }

    // Search the knowledge base
    const results = await findRelevantContent(params.query, {
      userId: params.includeUserContext ? userId : undefined,
      threshold: 0.4, // Slightly lower threshold for knowledge base
      limit: 5,
      sourceTypes,
    });

    if (results.length === 0) {
      return {
        success: true,
        found: false,
        message: 'No relevant information found in the knowledge base for this query.',
        suggestion: 'I can still try to help based on my general knowledge, but please verify any tax or accounting advice with a qualified professional.',
      };
    }

    // Format results for the AI to use
    const formattedResults = results.map((result, index) => ({
      rank: index + 1,
      content: result.content,
      relevance: `${(result.similarity * 100).toFixed(0)}%`,
      source: result.source_type,
      metadata: result.metadata,
    }));

    return {
      success: true,
      found: true,
      count: results.length,
      results: formattedResults,
      message: `Found ${results.length} relevant piece(s) of information.`,
    };
  } catch (error) {
    return {
      success: false,
      found: false,
      error: error instanceof Error ? error.message : 'Failed to search knowledge base',
    };
  }
}
