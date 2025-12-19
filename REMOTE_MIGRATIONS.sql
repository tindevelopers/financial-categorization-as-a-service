-- Combined Migration File for Remote Database
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/firwcvlikjltikdrmejq/sql/new
-- Created: 2025-12-19

-- ============================================================================
-- Migration 1: Create Financial Categorization Tables
-- ============================================================================

-- User uploads/jobs
CREATE TABLE IF NOT EXISTS categorization_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('spreadsheet', 'invoice', 'batch_invoice')),
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'reviewing', 'completed', 'failed', 'queued')),
  processing_mode TEXT NOT NULL DEFAULT 'sync' CHECK (processing_mode IN ('sync', 'async')),
  original_filename TEXT,
  file_url TEXT, -- Temporary Supabase Storage URL (if used)
  cloud_storage_provider TEXT CHECK (cloud_storage_provider IN ('dropbox', 'google_drive')),
  cloud_storage_path TEXT, -- Path in user's cloud storage
  cloud_storage_url TEXT, -- Direct link to document in cloud storage
  total_items INTEGER, -- Total invoices/transactions to process
  processed_items INTEGER DEFAULT 0, -- Items processed so far
  failed_items INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT
);

-- Categorized transactions
CREATE TABLE IF NOT EXISTS categorized_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES categorization_jobs(id) ON DELETE CASCADE,
  original_description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  category TEXT,
  subcategory TEXT,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1), -- 0.00 to 1.00
  user_confirmed BOOLEAN DEFAULT FALSE,
  user_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Category mappings (user-specific)
CREATE TABLE IF NOT EXISTS user_category_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL, -- Merchant name, keyword, etc.
  category TEXT NOT NULL,
  subcategory TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, pattern, category)
);

-- Document metadata (for search)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID REFERENCES categorization_jobs(id) ON DELETE CASCADE,
  cloud_storage_provider TEXT CHECK (cloud_storage_provider IN ('dropbox', 'google_drive')),
  cloud_storage_path TEXT,
  cloud_storage_url TEXT,
  original_filename TEXT NOT NULL,
  file_type TEXT CHECK (file_type IN ('invoice', 'receipt', 'statement', 'other')),
  vendor_name TEXT,
  invoice_date DATE,
  invoice_number TEXT,
  total_amount DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  extracted_text TEXT, -- Full extracted text for search
  ocr_confidence_score DECIMAL(3,2) CHECK (ocr_confidence_score >= 0 AND ocr_confidence_score <= 1),
  ocr_provider TEXT DEFAULT 'google_document_ai',
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_categorization_jobs_user_id ON categorization_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_categorization_jobs_tenant_id ON categorization_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categorization_jobs_status ON categorization_jobs(status);
CREATE INDEX IF NOT EXISTS idx_categorization_jobs_created_at ON categorization_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_job_id ON categorized_transactions(job_id);
CREATE INDEX IF NOT EXISTS idx_categorized_transactions_category ON categorized_transactions(category);
CREATE INDEX IF NOT EXISTS idx_categorized_transactions_date ON categorized_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_categorized_transactions_user_confirmed ON categorized_transactions(user_confirmed);

CREATE INDEX IF NOT EXISTS idx_user_category_mappings_user_id ON user_category_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_category_mappings_pattern ON user_category_mappings(pattern);
CREATE INDEX IF NOT EXISTS idx_user_category_mappings_category ON user_category_mappings(category);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_job_id ON documents(job_id);
CREATE INDEX IF NOT EXISTS idx_documents_vendor ON documents(vendor_name);
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(invoice_date);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_search ON documents USING gin(to_tsvector('english', COALESCE(extracted_text, '')));

-- RLS Policies
ALTER TABLE categorization_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorized_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_category_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs
CREATE POLICY "Users can view their own categorization jobs"
  ON categorization_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own categorization jobs"
  ON categorization_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categorization jobs"
  ON categorization_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only see transactions from their own jobs
CREATE POLICY "Users can view transactions from their own jobs"
  ON categorized_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM categorization_jobs
      WHERE categorization_jobs.id = categorized_transactions.job_id
      AND categorization_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert transactions for their own jobs"
  ON categorized_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM categorization_jobs
      WHERE categorization_jobs.id = categorized_transactions.job_id
      AND categorization_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update transactions from their own jobs"
  ON categorized_transactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM categorization_jobs
      WHERE categorization_jobs.id = categorized_transactions.job_id
      AND categorization_jobs.user_id = auth.uid()
    )
  );

-- Users can only see their own category mappings
CREATE POLICY "Users can view their own category mappings"
  ON user_category_mappings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own category mappings"
  ON user_category_mappings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own category mappings"
  ON user_category_mappings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own category mappings"
  ON user_category_mappings FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for documents
CREATE POLICY "Users can view their own documents"
  ON documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
  ON documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
  ON documents FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_categorized_transactions_updated_at ON categorized_transactions;
CREATE TRIGGER update_categorized_transactions_updated_at
  BEFORE UPDATE ON categorized_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_category_mappings_updated_at ON user_category_mappings;
CREATE TRIGGER update_user_category_mappings_updated_at
  BEFORE UPDATE ON user_category_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migration 2: Create Storage Bucket
-- ============================================================================

-- Create storage bucket for categorization uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'categorization-uploads',
  'categorization-uploads',
  false, -- Private bucket
  10485760, -- 10MB limit
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- .xlsx
    'application/vnd.ms-excel', -- .xls
    'text/csv', -- .csv
    'application/pdf', -- .pdf
    'image/jpeg', -- .jpg
    'image/png' -- .png
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: Users can upload their own files
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'categorization-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own files
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'categorization-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own files
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'categorization-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================================
-- Migration 3: Create Cloud Storage Connections Table
-- ============================================================================

-- Cloud storage connections (Dropbox, Google Drive)
CREATE TABLE IF NOT EXISTS cloud_storage_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('dropbox', 'google_drive')),
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cloud_storage_connections_user_id ON cloud_storage_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_storage_connections_tenant_id ON cloud_storage_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cloud_storage_connections_provider ON cloud_storage_connections(provider);
CREATE INDEX IF NOT EXISTS idx_cloud_storage_connections_active ON cloud_storage_connections(is_active);

-- RLS Policies
ALTER TABLE cloud_storage_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own cloud storage connections" ON cloud_storage_connections;
CREATE POLICY "Users can view their own cloud storage connections"
  ON cloud_storage_connections FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own cloud storage connections" ON cloud_storage_connections;
CREATE POLICY "Users can create their own cloud storage connections"
  ON cloud_storage_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own cloud storage connections" ON cloud_storage_connections;
CREATE POLICY "Users can update their own cloud storage connections"
  ON cloud_storage_connections FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own cloud storage connections" ON cloud_storage_connections;
CREATE POLICY "Users can delete their own cloud storage connections"
  ON cloud_storage_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_cloud_storage_connections_updated_at ON cloud_storage_connections;
CREATE TRIGGER update_cloud_storage_connections_updated_at
  BEFORE UPDATE ON cloud_storage_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
