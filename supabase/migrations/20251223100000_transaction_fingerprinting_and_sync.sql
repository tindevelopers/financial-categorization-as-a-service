-- Migration: Transaction Fingerprinting and Bidirectional Sync Infrastructure
-- Description: Add fingerprinting for duplicate detection and sync metadata for bidirectional sync
-- Created: 2025-12-23

-- ============================================================================
-- PHASE 1: TRANSACTION FINGERPRINTING
-- Add fingerprint and source tracking to categorized_transactions
-- ============================================================================

-- Add source tracking columns first (non-generated columns)
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

-- Add transaction fingerprint as a generated column
-- Fingerprint is based on description + amount + date (excludes category since that changes)
ALTER TABLE categorized_transactions 
  ADD COLUMN IF NOT EXISTS transaction_fingerprint TEXT GENERATED ALWAYS AS (
    encode(sha256(
      (COALESCE(original_description, '') || '|' || 
       COALESCE(amount::text, '0') || '|' || 
       COALESCE(date::text, '')
      )::bytea
    ), 'hex')
  ) STORED;

-- Create index for fingerprint lookups (critical for duplicate detection)
CREATE INDEX IF NOT EXISTS idx_categorized_transactions_fingerprint 
  ON categorized_transactions(transaction_fingerprint);

-- Create index for source type filtering
CREATE INDEX IF NOT EXISTS idx_categorized_transactions_source_type 
  ON categorized_transactions(source_type);

-- Create index for sync version (for conflict detection)
CREATE INDEX IF NOT EXISTS idx_categorized_transactions_sync_version 
  ON categorized_transactions(sync_version);

-- ============================================================================
-- PHASE 2: SYNC METADATA TABLE
-- Track sync state between database and external sources
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Source identification
  source_type TEXT NOT NULL CHECK (source_type IN ('google_sheets', 'airtable', 'excel')),
  source_id TEXT NOT NULL,           -- Spreadsheet ID or file identifier
  source_name TEXT,                  -- Human-readable name (e.g., "Q4 2024 Transactions")
  source_url TEXT,                   -- URL to the external source
  
  -- Job association (optional - links to a categorization job)
  job_id UUID REFERENCES categorization_jobs(id) ON DELETE SET NULL,
  
  -- Sync state
  last_sync_at TIMESTAMPTZ,
  last_sync_direction TEXT CHECK (last_sync_direction IN ('push', 'pull', 'bidirectional')),
  sync_cursor TEXT,                  -- For incremental sync (e.g., last row processed)
  row_count INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error', 'paused')),
  last_error TEXT,
  
  -- Sync configuration
  auto_sync_enabled BOOLEAN DEFAULT FALSE,
  sync_frequency TEXT DEFAULT 'manual' CHECK (sync_frequency IN ('manual', 'realtime', 'hourly', 'daily', 'weekly')),
  next_scheduled_sync TIMESTAMPTZ,
  conflict_resolution TEXT DEFAULT 'last_write_wins' 
    CHECK (conflict_resolution IN ('last_write_wins', 'db_priority', 'external_priority', 'flag_for_review')),
  
  -- Statistics
  total_syncs INTEGER DEFAULT 0,
  successful_syncs INTEGER DEFAULT 0,
  failed_syncs INTEGER DEFAULT 0,
  total_conflicts INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one sync config per source per user
  UNIQUE(user_id, source_type, source_id)
);

-- Indexes for sync_metadata
CREATE INDEX IF NOT EXISTS idx_sync_metadata_user_id ON sync_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_source ON sync_metadata(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_status ON sync_metadata(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_next_sync ON sync_metadata(next_scheduled_sync) 
  WHERE auto_sync_enabled = TRUE;

-- ============================================================================
-- PHASE 2: SYNC CONFLICTS TABLE
-- Track conflicts between database and external sources
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_metadata_id UUID REFERENCES sync_metadata(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES categorized_transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Conflict details
  source_type TEXT NOT NULL,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('value_mismatch', 'deleted_in_db', 'deleted_externally', 'duplicate')),
  field_name TEXT,                   -- Which field has the conflict (e.g., 'amount', 'category')
  
  -- Values
  db_value JSONB,                    -- Current database version
  external_value JSONB,              -- External source version
  db_updated_at TIMESTAMPTZ,
  external_updated_at TIMESTAMPTZ,
  
  -- Resolution
  resolution_status TEXT DEFAULT 'pending' CHECK (resolution_status IN ('pending', 'resolved', 'ignored')),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_choice TEXT CHECK (resolution_choice IN ('keep_db', 'use_external', 'manual_merge', 'ignore')),
  resolution_notes TEXT,
  
  -- Priority (for sorting/display)
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  amount_difference DECIMAL(10,2),   -- If amount conflict, store the difference
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate conflict entries for same transaction
  UNIQUE(transaction_id, source_type, field_name, resolution_status) 
    WHERE resolution_status = 'pending'
);

-- Indexes for sync_conflicts
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_user_id ON sync_conflicts(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_transaction ON sync_conflicts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_status ON sync_conflicts(resolution_status);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_pending ON sync_conflicts(user_id, resolution_status) 
  WHERE resolution_status = 'pending';

-- ============================================================================
-- PHASE 2: SYNC HISTORY TABLE
-- Log all sync operations for auditing
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_metadata_id UUID REFERENCES sync_metadata(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Sync details
  sync_direction TEXT NOT NULL CHECK (sync_direction IN ('push', 'pull', 'bidirectional')),
  sync_status TEXT NOT NULL CHECK (sync_status IN ('started', 'completed', 'failed', 'partial')),
  
  -- Statistics
  rows_processed INTEGER DEFAULT 0,
  rows_inserted INTEGER DEFAULT 0,
  rows_updated INTEGER DEFAULT 0,
  rows_skipped INTEGER DEFAULT 0,
  rows_deleted INTEGER DEFAULT 0,
  conflicts_detected INTEGER DEFAULT 0,
  conflicts_resolved INTEGER DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  
  -- Metadata
  triggered_by TEXT CHECK (triggered_by IN ('manual', 'scheduled', 'webhook', 'realtime')),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for sync_history
CREATE INDEX IF NOT EXISTS idx_sync_history_sync_metadata ON sync_history(sync_metadata_id);
CREATE INDEX IF NOT EXISTS idx_sync_history_user ON sync_history(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_history_status ON sync_history(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_history_created ON sync_history(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;

-- sync_metadata policies
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

-- sync_conflicts policies
CREATE POLICY "Users can view own sync conflicts"
  ON sync_conflicts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sync conflicts"
  ON sync_conflicts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync conflicts"
  ON sync_conflicts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sync conflicts"
  ON sync_conflicts FOR DELETE
  USING (auth.uid() = user_id);

-- sync_history policies
CREATE POLICY "Users can view own sync history"
  ON sync_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sync history"
  ON sync_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate transaction fingerprint (for use in queries)
CREATE OR REPLACE FUNCTION calculate_transaction_fingerprint(
  p_description TEXT,
  p_amount DECIMAL,
  p_date DATE
) RETURNS TEXT AS $$
BEGIN
  RETURN encode(sha256(
    (COALESCE(p_description, '') || '|' || 
     COALESCE(p_amount::text, '0') || '|' || 
     COALESCE(p_date::text, '')
    )::bytea
  ), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to detect duplicate transactions
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

-- Function to calculate similarity between two sets of transactions
CREATE OR REPLACE FUNCTION calculate_transaction_set_similarity(
  p_user_id UUID,
  p_fingerprints TEXT[]
) RETURNS TABLE (
  total_incoming INTEGER,
  matching_count INTEGER,
  new_count INTEGER,
  similarity_percentage DECIMAL
) AS $$
DECLARE
  v_total INTEGER;
  v_matching INTEGER;
BEGIN
  v_total := array_length(p_fingerprints, 1);
  
  IF v_total IS NULL OR v_total = 0 THEN
    RETURN QUERY SELECT 0, 0, 0, 0::DECIMAL;
    RETURN;
  END IF;
  
  SELECT COUNT(DISTINCT ct.transaction_fingerprint) INTO v_matching
  FROM categorized_transactions ct
  JOIN categorization_jobs cj ON ct.job_id = cj.id
  WHERE cj.user_id = p_user_id
    AND ct.transaction_fingerprint = ANY(p_fingerprints);
  
  RETURN QUERY SELECT 
    v_total,
    v_matching,
    v_total - v_matching,
    ROUND((v_matching::DECIMAL / v_total) * 100, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to resolve a sync conflict
CREATE OR REPLACE FUNCTION resolve_sync_conflict(
  p_conflict_id UUID,
  p_resolution_choice TEXT,
  p_resolved_by UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_conflict sync_conflicts%ROWTYPE;
BEGIN
  -- Get the conflict
  SELECT * INTO v_conflict FROM sync_conflicts WHERE id = p_conflict_id;
  
  IF v_conflict IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update the conflict record
  UPDATE sync_conflicts SET
    resolution_status = 'resolved',
    resolved_by = p_resolved_by,
    resolved_at = NOW(),
    resolution_choice = p_resolution_choice,
    resolution_notes = p_notes
  WHERE id = p_conflict_id;
  
  -- If choosing external value, update the transaction
  IF p_resolution_choice = 'use_external' AND v_conflict.transaction_id IS NOT NULL THEN
    -- Apply external values to the transaction
    UPDATE categorized_transactions SET
      original_description = COALESCE(v_conflict.external_value->>'original_description', original_description),
      amount = COALESCE((v_conflict.external_value->>'amount')::DECIMAL, amount),
      category = COALESCE(v_conflict.external_value->>'category', category),
      subcategory = COALESCE(v_conflict.external_value->>'subcategory', subcategory),
      sync_version = sync_version + 1,
      last_modified_source = 'conflict_resolution',
      updated_at = NOW()
    WHERE id = v_conflict.transaction_id;
  END IF;
  
  -- Update sync_metadata conflict count
  UPDATE sync_metadata SET
    total_conflicts = total_conflicts - 1
  WHERE id = v_conflict.sync_metadata_id
    AND total_conflicts > 0;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update sync_metadata.updated_at
CREATE TRIGGER update_sync_metadata_updated_at
  BEFORE UPDATE ON sync_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to increment sync_version on transaction update
CREATE OR REPLACE FUNCTION increment_sync_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if not already being set explicitly
  IF NEW.sync_version = OLD.sync_version THEN
    NEW.sync_version := OLD.sync_version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_transaction_sync_version
  BEFORE UPDATE ON categorized_transactions
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION increment_sync_version();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE sync_metadata IS 'Tracks sync state between database and external sources (Google Sheets, etc.)';
COMMENT ON TABLE sync_conflicts IS 'Records conflicts detected during bidirectional sync for manual resolution';
COMMENT ON TABLE sync_history IS 'Audit log of all sync operations';

COMMENT ON COLUMN categorized_transactions.transaction_fingerprint IS 'SHA-256 hash of description|amount|date for duplicate detection';
COMMENT ON COLUMN categorized_transactions.source_type IS 'Origin of this transaction: upload, google_sheets, manual, or api';
COMMENT ON COLUMN categorized_transactions.source_identifier IS 'External identifier (Sheet ID, filename, etc.)';
COMMENT ON COLUMN categorized_transactions.sync_version IS 'Incremented on each update for conflict detection';

COMMENT ON FUNCTION calculate_transaction_fingerprint IS 'Calculate fingerprint for a transaction (for pre-insert duplicate checking)';
COMMENT ON FUNCTION find_duplicate_transactions IS 'Find existing transactions matching given fingerprints';
COMMENT ON FUNCTION calculate_transaction_set_similarity IS 'Calculate similarity percentage between incoming and existing transactions';
COMMENT ON FUNCTION resolve_sync_conflict IS 'Resolve a sync conflict with the chosen resolution';

