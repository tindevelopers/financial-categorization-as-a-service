-- Migration: Create Cloud Storage Connections Table
-- Phase 2: Cloud storage integration
-- Created: 2025-12-19

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

CREATE POLICY "Users can view their own cloud storage connections"
  ON cloud_storage_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cloud storage connections"
  ON cloud_storage_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cloud storage connections"
  ON cloud_storage_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cloud storage connections"
  ON cloud_storage_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_cloud_storage_connections_updated_at
  BEFORE UPDATE ON cloud_storage_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
