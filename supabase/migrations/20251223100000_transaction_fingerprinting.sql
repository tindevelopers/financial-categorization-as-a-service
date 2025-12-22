-- Migration: Transaction Fingerprinting and Sync Columns
-- Description: Add fingerprinting for duplicate detection and sync tracking
-- Created: 2025-12-23

-- ============================================================================
-- TRANSACTION FINGERPRINTING
-- Unique identifier based on description + amount + date for deduplication
-- ============================================================================

-- Add source tracking columns to categorized_transactions
ALTER TABLE categorized_transactions 
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'upload' 
  CHECK (source_type IN ('upload', 'google_sheets', 'manual', 'api'));

ALTER TABLE categorized_transactions 
  ADD COLUMN IF NOT EXISTS source_identifier TEXT;

ALTER TABLE categorized_transactions 
  ADD COLUMN IF NOT EXISTS last_modified_source TEXT;

ALTER TABLE categorized_transactions 
  ADD COLUMN IF NOT EXISTS sync_version INTEGER DEFAULT 1;

ALTER TABLE categorized_transactions 
  ADD COLUMN IF NOT EXISTS external_row_id TEXT;

ALTER TABLE categorized_transactions 
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Create a function to generate transaction fingerprint
-- Using function instead of generated column for better PostgreSQL compatibility
CREATE OR REPLACE FUNCTION generate_transaction_fingerprint(
  p_description TEXT,
  p_amount DECIMAL,
  p_date DATE
) RETURNS TEXT AS $$
BEGIN
  RETURN encode(
    sha256(
      (COALESCE(LOWER(TRIM(p_description)), '') || '|' || 
       COALESCE(p_amount::text, '0') || '|' || 
       COALESCE(p_date::text, '')
      )::bytea
    ), 
    'hex'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add fingerprint column (computed on insert/update via trigger)
ALTER TABLE categorized_transactions 
  ADD COLUMN IF NOT EXISTS transaction_fingerprint TEXT;

-- Create trigger to auto-generate fingerprint
CREATE OR REPLACE FUNCTION update_transaction_fingerprint()
RETURNS TRIGGER AS $$
BEGIN
  NEW.transaction_fingerprint := generate_transaction_fingerprint(
    NEW.original_description,
    NEW.amount,
    NEW.date
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_transaction_fingerprint ON categorized_transactions;

-- Create trigger for insert and update
CREATE TRIGGER trigger_update_transaction_fingerprint
  BEFORE INSERT OR UPDATE OF original_description, amount, date
  ON categorized_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_fingerprint();

-- Backfill existing transactions with fingerprints
UPDATE categorized_transactions 
SET transaction_fingerprint = generate_transaction_fingerprint(
  original_description,
  amount,
  date
)
WHERE transaction_fingerprint IS NULL;

-- ============================================================================
-- INDEXES FOR DUPLICATE DETECTION
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_fingerprint 
  ON categorized_transactions(transaction_fingerprint);

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_source_type 
  ON categorized_transactions(source_type);

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_source_identifier 
  ON categorized_transactions(source_identifier);

CREATE INDEX IF NOT EXISTS idx_categorized_transactions_external_row_id 
  ON categorized_transactions(external_row_id);

-- Composite index for finding duplicates within a user's transactions
CREATE INDEX IF NOT EXISTS idx_categorized_transactions_user_fingerprint 
  ON categorized_transactions(job_id, transaction_fingerprint);

-- ============================================================================
-- SYNC METADATA TABLE
-- Track sync state between database and external sources
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('google_sheets', 'airtable', 'excel')),
  source_id TEXT NOT NULL,           -- Spreadsheet ID or file identifier
  source_name TEXT,                  -- Human-readable name
  sheet_name TEXT,                   -- Specific sheet/tab name
  last_sync_at TIMESTAMPTZ,
  last_sync_direction TEXT CHECK (last_sync_direction IN ('push', 'pull', 'bidirectional')),
  sync_cursor TEXT,                  -- For incremental sync tracking
  row_count INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error', 'pending')),
  sync_error TEXT,
  auto_sync_enabled BOOLEAN DEFAULT FALSE,
  sync_frequency TEXT DEFAULT 'manual' CHECK (sync_frequency IN ('manual', 'realtime', '15min', 'hourly', 'daily')),
  next_sync_at TIMESTAMPTZ,
  linked_job_id UUID REFERENCES categorization_jobs(id) ON DELETE SET NULL,
  column_mapping JSONB DEFAULT '{}',  -- Map sheet columns to DB fields
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source_type, source_id)
);

-- ============================================================================
-- SYNC CONFLICTS TABLE
-- Track conflicts requiring manual resolution
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES categorized_transactions(id) ON DELETE CASCADE,
  sync_metadata_id UUID REFERENCES sync_metadata(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('update', 'delete', 'create')),
  db_value JSONB,                    -- Database version of the transaction
  external_value JSONB,              -- External source version
  db_modified_at TIMESTAMPTZ,
  external_modified_at TIMESTAMPTZ,
  resolution_status TEXT DEFAULT 'pending' CHECK (resolution_status IN ('pending', 'resolved', 'ignored')),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_choice TEXT CHECK (resolution_choice IN ('db', 'external', 'manual', 'merge')),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SYNC HISTORY TABLE
-- Audit log of all sync operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_metadata_id UUID REFERENCES sync_metadata(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('push', 'pull', 'bidirectional')),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'partial')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  rows_pushed INTEGER DEFAULT 0,
  rows_pulled INTEGER DEFAULT 0,
  rows_skipped INTEGER DEFAULT 0,
  conflicts_detected INTEGER DEFAULT 0,
  error_message TEXT,
  details JSONB DEFAULT '{}'
);

-- ============================================================================
-- INDEXES FOR SYNC TABLES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sync_metadata_user_id ON sync_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_source_type ON sync_metadata(source_type);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_status ON sync_metadata(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_next_sync ON sync_metadata(next_sync_at) WHERE auto_sync_enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_user_id ON sync_conflicts(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_status ON sync_conflicts(resolution_status);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_transaction ON sync_conflicts(transaction_id);

CREATE INDEX IF NOT EXISTS idx_sync_history_metadata ON sync_history(sync_metadata_id);
CREATE INDEX IF NOT EXISTS idx_sync_history_user ON sync_history(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_history_started ON sync_history(started_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;

-- Sync Metadata Policies
CREATE POLICY "Users can view own sync metadata"
  ON sync_metadata FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sync metadata"
  ON sync_metadata FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync metadata"
  ON sync_metadata FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sync metadata"
  ON sync_metadata FOR DELETE
  USING (auth.uid() = user_id);

-- Sync Conflicts Policies
CREATE POLICY "Users can view own sync conflicts"
  ON sync_conflicts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own sync conflicts"
  ON sync_conflicts FOR UPDATE
  USING (auth.uid() = user_id);

-- Sync History Policies
CREATE POLICY "Users can view own sync history"
  ON sync_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sync history"
  ON sync_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_sync_metadata_updated_at
  BEFORE UPDATE ON sync_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to find duplicate transactions by fingerprint
CREATE OR REPLACE FUNCTION find_duplicate_transactions(
  p_user_id UUID,
  p_fingerprints TEXT[]
) RETURNS TABLE (
  fingerprint TEXT,
  transaction_id UUID,
  job_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ct.transaction_fingerprint,
    ct.id,
    ct.job_id
  FROM categorized_transactions ct
  JOIN categorization_jobs cj ON ct.job_id = cj.id
  WHERE cj.user_id = p_user_id
    AND ct.transaction_fingerprint = ANY(p_fingerprints);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate similarity percentage between two sets of fingerprints
CREATE OR REPLACE FUNCTION calculate_fingerprint_similarity(
  p_user_id UUID,
  p_new_fingerprints TEXT[]
) RETURNS TABLE (
  total_new INTEGER,
  matching_count INTEGER,
  similarity_percentage DECIMAL
) AS $$
DECLARE
  v_total INTEGER;
  v_matching INTEGER;
BEGIN
  v_total := array_length(p_new_fingerprints, 1);
  
  IF v_total IS NULL OR v_total = 0 THEN
    RETURN QUERY SELECT 0, 0, 0::DECIMAL;
    RETURN;
  END IF;
  
  SELECT COUNT(DISTINCT ct.transaction_fingerprint)
  INTO v_matching
  FROM categorized_transactions ct
  JOIN categorization_jobs cj ON ct.job_id = cj.id
  WHERE cj.user_id = p_user_id
    AND ct.transaction_fingerprint = ANY(p_new_fingerprints);
  
  RETURN QUERY SELECT 
    v_total,
    v_matching,
    ROUND((v_matching::DECIMAL / v_total::DECIMAL) * 100, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE sync_metadata IS 'Tracks sync state between database and external sources like Google Sheets';
COMMENT ON TABLE sync_conflicts IS 'Stores conflicts detected during bidirectional sync for manual resolution';
COMMENT ON TABLE sync_history IS 'Audit log of all sync operations';

COMMENT ON COLUMN categorized_transactions.transaction_fingerprint IS 'SHA-256 hash of description|amount|date for duplicate detection';
COMMENT ON COLUMN categorized_transactions.source_type IS 'Origin of the transaction: upload, google_sheets, manual, or api';
COMMENT ON COLUMN categorized_transactions.source_identifier IS 'External identifier (e.g., spreadsheet ID, filename)';
COMMENT ON COLUMN categorized_transactions.sync_version IS 'Incremented on each sync for conflict detection';
COMMENT ON COLUMN categorized_transactions.external_row_id IS 'Row identifier in external source for mapping';

COMMENT ON FUNCTION generate_transaction_fingerprint IS 'Generates consistent hash for transaction deduplication';
COMMENT ON FUNCTION find_duplicate_transactions IS 'Finds existing transactions matching given fingerprints';
COMMENT ON FUNCTION calculate_fingerprint_similarity IS 'Calculates percentage of new fingerprints that already exist';

