-- Migration: Create Financial Documents Table
-- Stores bank statements, receipts, invoices with storage lifecycle management
-- Created: 2025-12-20

-- Create financial_documents table
CREATE TABLE IF NOT EXISTS financial_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- File info
  original_filename TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('bank_statement', 'receipt', 'invoice', 'tax_document', 'other')),
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT,
  file_hash TEXT,  -- SHA-256 hash for deduplication
  
  -- Storage location
  storage_tier TEXT DEFAULT 'hot' CHECK (storage_tier IN ('hot', 'archive', 'restoring')),
  supabase_path TEXT,           -- Path when in hot storage
  gcs_archive_path TEXT,        -- Path when archived
  archived_at TIMESTAMP,
  restore_requested_at TIMESTAMP,  -- When user requested restore from archive
  
  -- OCR and extracted data
  ocr_status TEXT DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  ocr_error TEXT,
  extracted_text TEXT,
  extracted_data JSONB DEFAULT '{}',  -- Structured data (amounts, dates, vendors, line items)
  ocr_confidence DECIMAL(3,2) CHECK (ocr_confidence IS NULL OR (ocr_confidence >= 0 AND ocr_confidence <= 1)),
  ocr_provider TEXT DEFAULT 'google_document_ai',
  ocr_processed_at TIMESTAMP,
  
  -- Document metadata (extracted or manually entered)
  document_date DATE,           -- Date on the document
  period_start DATE,            -- For statements: period start
  period_end DATE,              -- For statements: period end
  vendor_name TEXT,
  document_number TEXT,         -- Invoice number, statement number, etc.
  total_amount DECIMAL(12,2),
  currency TEXT DEFAULT 'USD',
  
  -- Categorization
  category TEXT,
  subcategory TEXT,
  tags TEXT[],
  
  -- Metadata
  description TEXT,
  notes TEXT,
  is_verified BOOLEAN DEFAULT FALSE,  -- User verified the extracted data
  
  -- Soft delete
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_financial_documents_entity_id ON financial_documents(entity_id);
CREATE INDEX IF NOT EXISTS idx_financial_documents_tenant_id ON financial_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_financial_documents_user_id ON financial_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_documents_file_type ON financial_documents(file_type);
CREATE INDEX IF NOT EXISTS idx_financial_documents_storage_tier ON financial_documents(storage_tier);
CREATE INDEX IF NOT EXISTS idx_financial_documents_ocr_status ON financial_documents(ocr_status);
CREATE INDEX IF NOT EXISTS idx_financial_documents_document_date ON financial_documents(document_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_documents_vendor_name ON financial_documents(vendor_name);
CREATE INDEX IF NOT EXISTS idx_financial_documents_created_at ON financial_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_documents_archived_at ON financial_documents(archived_at);
CREATE INDEX IF NOT EXISTS idx_financial_documents_file_hash ON financial_documents(file_hash);
CREATE INDEX IF NOT EXISTS idx_financial_documents_category ON financial_documents(category);

-- Full-text search index on extracted_text
CREATE INDEX IF NOT EXISTS idx_financial_documents_search 
  ON financial_documents 
  USING gin(to_tsvector('english', COALESCE(extracted_text, '') || ' ' || COALESCE(vendor_name, '') || ' ' || COALESCE(original_filename, '')));

-- GIN index for tags array
CREATE INDEX IF NOT EXISTS idx_financial_documents_tags ON financial_documents USING gin(tags);

-- Enable RLS
ALTER TABLE financial_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view documents they uploaded
CREATE POLICY "Users can view their own documents"
  ON financial_documents FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view documents for entities they own
CREATE POLICY "Users can view documents for their entities"
  ON financial_documents FOR SELECT
  USING (
    entity_id IN (
      SELECT e.id FROM entities e 
      WHERE e.owner_user_id = auth.uid()
    )
  );

-- Users can view documents in their tenant
CREATE POLICY "Users can view tenant documents"
  ON financial_documents FOR SELECT
  USING (
    tenant_id IN (
      SELECT u.tenant_id FROM users u WHERE u.id = auth.uid()
    )
  );

-- Platform admins can view all documents
CREATE POLICY "Platform admins can view all documents"
  ON financial_documents FOR SELECT
  USING (is_platform_admin());

-- Users can create documents
CREATE POLICY "Users can create documents"
  ON financial_documents FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      entity_id IS NULL
      OR entity_id IN (
        SELECT e.id FROM entities e 
        WHERE e.owner_user_id = auth.uid()
        OR e.tenant_id IN (SELECT u.tenant_id FROM users u WHERE u.id = auth.uid())
      )
    )
  );

-- Users can update their own documents
CREATE POLICY "Users can update their own documents"
  ON financial_documents FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can update documents for their entities
CREATE POLICY "Users can update entity documents"
  ON financial_documents FOR UPDATE
  USING (
    entity_id IN (
      SELECT e.id FROM entities e 
      WHERE e.owner_user_id = auth.uid()
      OR e.tenant_id IN (SELECT u.tenant_id FROM users u WHERE u.id = auth.uid())
    )
  );

-- Users can delete their own documents
CREATE POLICY "Users can delete their own documents"
  ON financial_documents FOR DELETE
  USING (auth.uid() = user_id);

-- Platform admins can manage all documents
CREATE POLICY "Platform admins can manage all documents"
  ON financial_documents FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Trigger for updated_at
CREATE TRIGGER update_financial_documents_updated_at
  BEFORE UPDATE ON financial_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to search documents
CREATE OR REPLACE FUNCTION search_financial_documents(
  search_query TEXT,
  p_user_id UUID DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_file_type TEXT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  original_filename TEXT,
  file_type TEXT,
  document_date DATE,
  vendor_name TEXT,
  total_amount DECIMAL(12,2),
  storage_tier TEXT,
  ocr_status TEXT,
  created_at TIMESTAMP,
  search_rank REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fd.id,
    fd.original_filename,
    fd.file_type,
    fd.document_date,
    fd.vendor_name,
    fd.total_amount,
    fd.storage_tier,
    fd.ocr_status,
    fd.created_at,
    ts_rank(
      to_tsvector('english', COALESCE(fd.extracted_text, '') || ' ' || COALESCE(fd.vendor_name, '') || ' ' || COALESCE(fd.original_filename, '')),
      plainto_tsquery('english', search_query)
    ) AS search_rank
  FROM financial_documents fd
  WHERE 
    -- Full-text search
    (search_query IS NULL OR search_query = '' OR 
     to_tsvector('english', COALESCE(fd.extracted_text, '') || ' ' || COALESCE(fd.vendor_name, '') || ' ' || COALESCE(fd.original_filename, ''))
     @@ plainto_tsquery('english', search_query))
    -- Filters
    AND (p_user_id IS NULL OR fd.user_id = p_user_id)
    AND (p_entity_id IS NULL OR fd.entity_id = p_entity_id)
    AND (p_file_type IS NULL OR fd.file_type = p_file_type)
    AND (p_date_from IS NULL OR fd.document_date >= p_date_from)
    AND (p_date_to IS NULL OR fd.document_date <= p_date_to)
  ORDER BY 
    CASE WHEN search_query IS NOT NULL AND search_query != '' 
      THEN ts_rank(
        to_tsvector('english', COALESCE(fd.extracted_text, '') || ' ' || COALESCE(fd.vendor_name, '') || ' ' || COALESCE(fd.original_filename, '')),
        plainto_tsquery('english', search_query)
      )
      ELSE 0 
    END DESC,
    fd.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION search_financial_documents TO authenticated;

-- Comments
COMMENT ON TABLE financial_documents IS 'Stores financial documents (bank statements, receipts, invoices) with storage lifecycle management';
COMMENT ON COLUMN financial_documents.storage_tier IS 'Current storage location: hot (Supabase), archive (GCS), restoring (being restored from archive)';
COMMENT ON COLUMN financial_documents.extracted_data IS 'Structured data extracted by OCR including amounts, dates, line items';
COMMENT ON COLUMN financial_documents.file_hash IS 'SHA-256 hash of file content for deduplication';
COMMENT ON FUNCTION search_financial_documents IS 'Full-text search across financial documents with filtering';
