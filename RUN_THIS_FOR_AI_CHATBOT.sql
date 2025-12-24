-- ============================================
-- AI CHATBOT SETUP SCRIPT
-- ============================================
-- Run this in your Supabase SQL Editor to enable the AI Chatbot
-- This adds chat sessions, messages, and embeddings tables with pgvector
--
-- Prerequisites:
-- 1. Run previous migrations first (categorization, reconciliation, sheets)
-- 2. Ensure you have the update_updated_at_column() function (from earlier migrations)
-- ============================================

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 1. Chat Sessions Table
-- ============================================
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New Chat',
  context JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. Chat Messages Table
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. Embeddings Table for RAG
-- ============================================
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536), -- text-embedding-ada-002 dimension
  source_type TEXT NOT NULL DEFAULT 'knowledge' CHECK (source_type IN ('knowledge', 'transaction', 'document', 'user_note')),
  source_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. Knowledge Base Table
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_tenant_id ON chat_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_embeddings_user_id ON embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_tenant_id ON embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_source_type ON embeddings(source_type);

-- Vector similarity search index
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tags ON knowledge_base USING gin(tags);

-- ============================================
-- 6. RLS Policies
-- ============================================
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- Chat sessions
DROP POLICY IF EXISTS "Users can view their own chat sessions" ON chat_sessions;
CREATE POLICY "Users can view their own chat sessions"
  ON chat_sessions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own chat sessions" ON chat_sessions;
CREATE POLICY "Users can create their own chat sessions"
  ON chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own chat sessions" ON chat_sessions;
CREATE POLICY "Users can update their own chat sessions"
  ON chat_sessions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own chat sessions" ON chat_sessions;
CREATE POLICY "Users can delete their own chat sessions"
  ON chat_sessions FOR DELETE USING (auth.uid() = user_id);

-- Chat messages
DROP POLICY IF EXISTS "Users can view messages from their sessions" ON chat_messages;
CREATE POLICY "Users can view messages from their sessions"
  ON chat_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM chat_sessions
    WHERE chat_sessions.id = chat_messages.session_id
    AND chat_sessions.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert messages to their sessions" ON chat_messages;
CREATE POLICY "Users can insert messages to their sessions"
  ON chat_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM chat_sessions
    WHERE chat_sessions.id = chat_messages.session_id
    AND chat_sessions.user_id = auth.uid()
  ));

-- Embeddings
DROP POLICY IF EXISTS "Users can view their own embeddings and global knowledge" ON embeddings;
CREATE POLICY "Users can view their own embeddings and global knowledge"
  ON embeddings FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own embeddings" ON embeddings;
CREATE POLICY "Users can create their own embeddings"
  ON embeddings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own embeddings" ON embeddings;
CREATE POLICY "Users can delete their own embeddings"
  ON embeddings FOR DELETE USING (auth.uid() = user_id);

-- Knowledge base
DROP POLICY IF EXISTS "Authenticated users can read knowledge base" ON knowledge_base;
CREATE POLICY "Authenticated users can read knowledge base"
  ON knowledge_base FOR SELECT TO authenticated USING (is_active = TRUE);

-- ============================================
-- 7. RPC Function for Vector Search
-- ============================================
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  user_filter uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  source_type text,
  source_id uuid,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.content,
    e.source_type,
    e.source_id,
    e.metadata,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM embeddings e
  WHERE 
    (user_filter IS NULL AND e.user_id IS NULL)
    OR e.user_id = user_filter
    OR e.user_id IS NULL
  AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- 8. Triggers
-- ============================================
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_knowledge_base_updated_at ON knowledge_base;
CREATE TRIGGER update_knowledge_base_updated_at
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. Seed Knowledge Base
-- ============================================
INSERT INTO knowledge_base (category, title, content, tags) VALUES
-- HMRC Categories
('hmrc', 'Allowable Business Expenses', 
 'Allowable business expenses are costs that can be deducted from income to reduce taxable profit. Common categories include: Office costs (stationery, phone bills), Travel costs (fuel, parking, train fares for business travel), Clothing expenses (uniforms), Staff costs (salaries, subcontractor costs), Financial costs (bank charges, insurance), Costs of premises (rent, utilities), Advertising and marketing costs, Training courses related to your business.',
 ARRAY['expenses', 'deductions', 'tax']),

('hmrc', 'Disallowable Expenses', 
 'Disallowable expenses cannot be deducted from taxable profit. These include: Entertainment costs (client dinners, hospitality), Personal expenses, Fines and penalties, Political donations, Non-business travel, Personal portion of dual-use items.',
 ARRAY['expenses', 'non-deductible', 'tax']),

('hmrc', 'Capital Allowances', 
 'Capital allowances let you deduct the cost of business assets from profits. Annual Investment Allowance (AIA) provides 100% first-year relief up to £1 million. Writing Down Allowance (WDA) at 18% for main pool items or 6% for special rate pool. First Year Allowances at 100% for qualifying energy-efficient equipment.',
 ARRAY['capital', 'assets', 'allowances', 'aia']),

-- VAT Guidance
('vat', 'VAT Registration Threshold', 
 'You must register for VAT if your taxable turnover exceeds £90,000 in any 12-month period (as of April 2024). Voluntary registration is possible below this threshold. VAT registration allows you to reclaim VAT on business purchases.',
 ARRAY['vat', 'registration', 'threshold']),

('vat', 'VAT Rates', 
 'Standard rate: 20% applies to most goods and services. Reduced rate: 5% applies to some goods like home energy, children car seats. Zero rate: 0% applies to most food, books, children clothing, public transport. Exempt: No VAT charged, includes financial services, insurance, education.',
 ARRAY['vat', 'rates', 'standard', 'reduced', 'zero']),

('vat', 'Flat Rate VAT Scheme', 
 'Small businesses can use the Flat Rate Scheme if turnover is under £150,000 (excluding VAT). You pay a fixed percentage of turnover based on your business sector. First-year discount of 1% available. Cannot reclaim VAT on purchases except capital assets over £2,000.',
 ARRAY['vat', 'flat-rate', 'small-business']),

-- Accounting Guidance  
('accounting', 'Cash vs Accrual Accounting', 
 'Cash basis: Record income when received and expenses when paid. Simpler for small businesses. Available if turnover under £150,000. Accrual basis: Record income when earned and expenses when incurred. Required for larger businesses. Better matches income to related expenses.',
 ARRAY['accounting', 'cash-basis', 'accrual']),

('accounting', 'Record Keeping Requirements', 
 'HMRC requires you to keep records for at least 5 years (6 years for companies). Records must include: All sales and income, All purchases and expenses, VAT records if registered, PAYE records if you have employees, Bank statements, Invoices issued and received.',
 ARRAY['records', 'compliance', 'hmrc']),

('accounting', 'Common Expense Categories', 
 'Standard expense categories for UK businesses: Cost of Sales (materials, stock), Office Costs, Travel & Subsistence, Motor Expenses, Professional Fees (accountant, legal), Marketing & Advertising, Bank Charges, Insurance, Subscriptions, Training, Utilities, Repairs & Maintenance, Equipment (under capital threshold).',
 ARRAY['categories', 'expenses', 'bookkeeping']),

-- App Help
('app_help', 'How to Categorize Transactions', 
 'FinCat uses AI to automatically categorize your transactions. Upload a bank statement or spreadsheet, and the AI will suggest categories based on the transaction description and amount. You can review and confirm suggestions, or manually override them. Your corrections help train the AI for better future suggestions.',
 ARRAY['categorization', 'ai', 'transactions', 'help']),

('app_help', 'Google Sheets Integration', 
 'Connect your Google Sheets to sync transactions bidirectionally. Pull: Import transactions from your spreadsheet. Push: Export categorized transactions to your sheet. Sync: Keep both in sync with conflict detection. Configure column mappings in Settings > Integrations.',
 ARRAY['sheets', 'integration', 'sync', 'help']),

('app_help', 'Reconciliation Process', 
 'Reconciliation matches your categorized transactions against bank statements. Upload a bank statement to compare. FinCat highlights matched, unmatched, and discrepant items. Mark items as reconciled once verified. Use the reconciliation report for your accountant.',
 ARRAY['reconciliation', 'bank', 'matching', 'help'])

ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'AI Chatbot tables created successfully!' AS status;

SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('chat_sessions', 'chat_messages', 'embeddings', 'knowledge_base')
ORDER BY table_name;

SELECT COUNT(*) as knowledge_base_entries FROM knowledge_base;

