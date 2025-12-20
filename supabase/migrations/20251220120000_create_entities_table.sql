-- Migration: Create Entities Table
-- Entities represent persons or businesses that own financial documents
-- Created: 2025-12-20

-- Create entities table
CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- null if entity IS the tenant
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'business')),
  name TEXT NOT NULL,
  tax_id_encrypted TEXT,  -- EIN or SSN (encrypted at application level)
  email TEXT,
  phone TEXT,
  address JSONB,  -- { street, city, state, zip, country }
  metadata JSONB DEFAULT '{}',  -- Flexible additional data
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_entities_tenant_id ON entities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_entities_owner_user_id ON entities(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_entities_entity_type ON entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
CREATE INDEX IF NOT EXISTS idx_entities_is_active ON entities(is_active);
CREATE INDEX IF NOT EXISTS idx_entities_created_at ON entities(created_at DESC);

-- Enable RLS
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view entities they own (as owner_user_id)
CREATE POLICY "Users can view their own entities"
  ON entities FOR SELECT
  USING (auth.uid() = owner_user_id);

-- Users can view entities in their tenant
CREATE POLICY "Users can view tenant entities"
  ON entities FOR SELECT
  USING (
    tenant_id IN (
      SELECT u.tenant_id FROM users u WHERE u.id = auth.uid()
    )
  );

-- Platform admins can view all entities
CREATE POLICY "Platform admins can view all entities"
  ON entities FOR SELECT
  USING (is_platform_admin());

-- Users can create entities for their tenant
CREATE POLICY "Users can create entities for their tenant"
  ON entities FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT u.tenant_id FROM users u WHERE u.id = auth.uid()
    )
    OR auth.uid() = owner_user_id
  );

-- Users can update their own entities or tenant entities
CREATE POLICY "Users can update their own entities"
  ON entities FOR UPDATE
  USING (
    auth.uid() = owner_user_id
    OR tenant_id IN (
      SELECT u.tenant_id FROM users u WHERE u.id = auth.uid()
    )
  );

-- Users can delete their own entities
CREATE POLICY "Users can delete their own entities"
  ON entities FOR DELETE
  USING (
    auth.uid() = owner_user_id
    OR tenant_id IN (
      SELECT u.tenant_id FROM users u WHERE u.id = auth.uid()
    )
  );

-- Platform admins can manage all entities
CREATE POLICY "Platform admins can manage all entities"
  ON entities FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Trigger for updated_at
CREATE TRIGGER update_entities_updated_at
  BEFORE UPDATE ON entities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE entities IS 'Represents persons or businesses that own financial documents';
COMMENT ON COLUMN entities.owner_user_id IS 'User who owns this entity directly. Null if entity represents the tenant itself.';
COMMENT ON COLUMN entities.tax_id_encrypted IS 'Encrypted tax identification number (EIN for business, SSN for person)';
COMMENT ON COLUMN entities.address IS 'JSON object containing street, city, state, zip, country';
