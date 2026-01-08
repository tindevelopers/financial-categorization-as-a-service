/**
 * Chat API Route
 * 
 * Main streaming chat endpoint for FinCat AI Chatbot
 * Adapted from vercel-labs/ai-gateway-embeddings-demo
 */

import { NextRequest, NextResponse } from 'next/server';
import { streamText, CoreMessage } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { createClient } from '@/core/database/server';
import { buildSystemPrompt, ChatContext } from '@/lib/ai/prompts';
import {
  queryTransactionsSchema,
  queryTransactionsDescription,
  executeQueryTransactions,
  updateTransactionSchema,
  updateTransactionDescription,
  executeUpdateTransaction,
  syncSheetsSchema,
  syncSheetsDescription,
  executeSyncSheets,
  searchKnowledgeSchema,
  searchKnowledgeDescription,
  executeSearchKnowledge,
  getJobStatsSchema,
  getJobStatsDescription,
  executeGetJobStats,
  exportDataSchema,
  exportDataDescription,
  executeExportData,
  summarizeCounterpartySchema,
  summarizeCounterpartyDescription,
  executeSummarizeCounterparty,
} from '@/lib/ai/tools';

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequestBody {
  messages: ChatMessage[];
  sessionId?: string;
  context?: ChatContext;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to use the AI assistant.' },
        { status: 401 }
      );
    }

    // Parse request body
    const { messages, sessionId, context }: ChatRequestBody = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid request: messages array is required' },
        { status: 400 }
      );
    }

    // Get or create chat session
    let chatSessionId = sessionId;
    
    if (!chatSessionId) {
      // Create a new session using raw fetch to avoid type issues with new tables
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tableClient = supabase as any;
        const { data: session, error: sessionError } = await tableClient
          .from('chat_sessions')
          .insert({
            user_id: user.id,
            title: 'New Chat',
            context: context || {},
          })
          .select('id')
          .single();

        if (!sessionError && session) {
          chatSessionId = session.id;
        }
      } catch (e) {
        console.error('Failed to create chat session:', e);
        // Continue without session persistence
      }
    }

    // Save user message if we have a session
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (chatSessionId && lastUserMessage) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tableClient = supabase as any;
        await tableClient
          .from('chat_messages')
          .insert({
            session_id: chatSessionId,
            role: 'user',
            content: lastUserMessage.content,
          });
      } catch (e) {
        console.error('Failed to save user message:', e);
      }
    }

    // Build system prompt with context
    const systemPrompt = buildSystemPrompt(context);

    // Convert messages to CoreMessage format
    const coreMessages: CoreMessage[] = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Stream the response using Vercel AI Gateway
    const result = streamText({
      model: gateway('openai/gpt-4o'),
      system: systemPrompt,
      messages: coreMessages,
      tools: {
        queryTransactions: {
          description: queryTransactionsDescription,
          inputSchema: queryTransactionsSchema,
          execute: async (params: unknown) => executeQueryTransactions(queryTransactionsSchema.parse(params), user.id, supabase),
        },
        updateTransaction: {
          description: updateTransactionDescription,
          inputSchema: updateTransactionSchema,
          execute: async (params: unknown) => executeUpdateTransaction(updateTransactionSchema.parse(params), user.id, supabase),
        },
        syncGoogleSheets: {
          description: syncSheetsDescription,
          inputSchema: syncSheetsSchema,
          execute: async (params: unknown) => executeSyncSheets(syncSheetsSchema.parse(params), user.id, supabase),
        },
        searchKnowledge: {
          description: searchKnowledgeDescription,
          inputSchema: searchKnowledgeSchema,
          execute: async (params: unknown) => executeSearchKnowledge(searchKnowledgeSchema.parse(params), user.id),
        },
        getJobStats: {
          description: getJobStatsDescription,
          inputSchema: getJobStatsSchema,
          execute: async (params: unknown) => executeGetJobStats(getJobStatsSchema.parse(params), user.id, supabase),
        },
        exportData: {
          description: exportDataDescription,
          inputSchema: exportDataSchema,
          execute: async (params: unknown) => executeExportData(exportDataSchema.parse(params), user.id, supabase),
        },
        summarizeCounterparty: {
          description: summarizeCounterpartyDescription,
          inputSchema: summarizeCounterpartySchema,
          execute: async (params: unknown) => executeSummarizeCounterparty(summarizeCounterpartySchema.parse(params), user.id, supabase),
        },
      },
      // Callback when generation is complete
      onFinish: async ({ text }) => {
        // Save assistant message to session
        if (chatSessionId && text) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tableClient = supabase as any;
            await tableClient
              .from('chat_messages')
              .insert({
                session_id: chatSessionId,
                role: 'assistant',
                content: text,
              });

            // Update session title from first user message if it's still "New Chat"
            if (lastUserMessage) {
              const { data: session } = await tableClient
                .from('chat_sessions')
                .select('title')
                .eq('id', chatSessionId)
                .single();

              if (session?.title === 'New Chat') {
                const title = lastUserMessage.content.slice(0, 50) + 
                  (lastUserMessage.content.length > 50 ? '...' : '');
                
                await tableClient
                  .from('chat_sessions')
                  .update({ title })
                  .eq('id', chatSessionId);
              }
            }
          } catch (e) {
            console.error('Failed to save assistant message:', e);
          }
        }
      },
    });

    // Return the streaming response
    return result.toTextStreamResponse({
      headers: {
        'X-Chat-Session-Id': chatSessionId || '',
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    
    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('AI Gateway requires a valid credit card')) {
        return NextResponse.json(
          { 
            error: 'AI Gateway not activated. Please add a credit card to your Vercel account.',
            code: 'GATEWAY_NOT_ACTIVATED',
          },
          { status: 402 }
        );
      }
      
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded. Please wait a moment and try again.',
            code: 'RATE_LIMITED',
          },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'An error occurred while processing your request.' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve chat history
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '10');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tableClient = supabase as any;

    if (sessionId) {
      // Get messages for a specific session
      const { data: messages, error } = await tableClient
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(1000);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ messages });
    }

    // Get recent sessions
    const { data: sessions, error } = await tableClient
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sessions });

  } catch (error) {
    console.error('Chat history error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve chat history' },
      { status: 500 }
    );
  }
}

// DELETE endpoint to remove a chat session
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Delete session (messages will cascade delete)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tableClient = supabase as any;
    const { error } = await tableClient
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete session error:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
